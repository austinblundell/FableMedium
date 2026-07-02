import * as THREE from 'three';
import {
  COURT_LEN, COURT_WID, HOOP_X, THREE_PT_R, THREE_PT_CORNER,
  SHOT_CLOCK, QUARTERS, TEAMS, ARCHETYPES, DIFFICULTY,
} from './constants.js';
import { Player } from './player.js';
import { Ball } from './ball.js';
import { updateAI } from './ai.js';
import { audio } from './audio.js';

const _v = new THREE.Vector3();

export class Game {
  constructor(scene, ui) {
    this.scene = scene;
    this.ui = ui;

    this.state = 'menu';          // menu | playing | dead | gameover
    this.deadTimer = 0;
    this.deadNext = null;

    this.players = [];
    this.teams = [];
    this.ball = new Ball(scene);
    this.ball.onScore = info => this.#onScore(info);
    this.ball.onShotMissedDead = shot => { this.reboundTeam = shot.shooter.teamIdx; };

    this.userTeam = 0;
    this.controlled = null;
    this.possession = -1;
    this.lastTouchTeam = 0;
    this.reboundTeam = -1;
    this.pendingInbound = null;

    this.quarter = 1;
    this.quarterLen = 180;
    this.gameClock = 180;
    this.shotClock = SHOT_CLOCK;
    this.difficulty = DIFFICULTY.pro;

    // input state
    this.keys = {};
    this.charging = false;
    this.chargeT = 0;

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.#onKeyDown(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      this.#onKeyUp(e.code);
    });
  }

  // -------------------------------------------------------------- setup ---

  start(settings) {
    // tear down previous rosters
    for (const p of this.players) this.scene.remove(p.group);
    this.players = [];

    const homeDef = TEAMS[settings.home] || TEAMS.LAL;
    const awayDef = TEAMS[settings.away] || TEAMS.BOS;
    this.teams = [
      { def: homeDef, score: 0 },
      { def: awayDef, score: 0 },
    ];
    this.difficulty = DIFFICULTY[settings.difficulty] || DIFFICULTY.pro;
    this.quarterLen = settings.quarterLen || 180;

    for (let t = 0; t < 2; t++) {
      for (let s = 0; s < 5; s++) {
        this.players.push(new Player(this.scene, t, s, this.teams[t].def, ARCHETYPES[s]));
      }
    }

    this.quarter = 1;
    this.gameClock = this.quarterLen;
    this.state = 'playing';
    this.resetFormation(0, `${homeDef.nick.toUpperCase()} BALL — TIP OFF!`);
    audio.cheer();
  }

  attackDir(teamIdx) { return teamIdx === 0 ? 1 : -1; }
  attackHoopX(teamIdx) { return this.attackDir(teamIdx) * HOOP_X; }

  quarterLabel() {
    return this.quarter <= QUARTERS ? `Q${this.quarter}` : `OT${this.quarter - QUARTERS}`;
  }

  setPossession(teamIdx) {
    if (this.possession !== teamIdx) this.shotClock = SHOT_CLOCK;
    this.possession = teamIdx;
  }

  // Place both teams in a half-court set and hand the ball to the attacking PG.
  resetFormation(possTeam, message) {
    const dir = this.attackDir(possTeam);
    const spots = [
      [HOOP_X - 8.5, 0], [HOOP_X - 5.5, -5.4], [HOOP_X - 5.5, 5.4],
      [HOOP_X - 1.5, -6.0], [HOOP_X - 2.5, 1.6],
    ];
    for (const p of this.players) {
      const s = spots[p.slot];
      if (p.teamIdx === possTeam) {
        p.pos.set(dir * s[0], 0, s[1]);
      } else {
        p.pos.set(dir * (s[0] + (HOOP_X - s[0]) * 0.35), 0, s[1] * 0.7);
      }
      p.jumpY = 0; p.isJumping = false; p.vy = 0;
      p.hasBall = false;
      p.faceToward(dir * HOOP_X, 0);
    }
    const pg = this.players[possTeam * 5];
    this.ball.give(pg);
    this.setPossession(possTeam);
    this.shotClock = SHOT_CLOCK;
    this.lastTouchTeam = possTeam;
    this.reboundTeam = -1;
    this.pendingInbound = null;
    this.charging = false;
    this.ui.hideMeter();

    if (message) {
      this.state = 'dead';
      this.deadTimer = 1.4;
      this.deadNext = 'playing';
      this.ui.showBanner(message, 1400);
    }
  }

  // ------------------------------------------------------------ actions ---

  shotQuality(shooter, timingBonus) {
    const hoopX = this.attackHoopX(shooter.teamIdx);
    const dist = Math.hypot(hoopX - shooter.pos.x, shooter.pos.z);
    const beyondArc = this.#isThree(shooter);
    const base = beyondArc ? shooter.arch.three * 0.92 : shooter.arch.shooting;
    const distFactor = Math.max(0.3, Math.min(1.1, 1.18 - dist * 0.055));

    // contest: nearest opponent, harsher when airborne
    let contest = 0;
    for (const q of this.players) {
      if (q.teamIdx === shooter.teamIdx) continue;
      const d = Math.hypot(q.pos.x - shooter.pos.x, q.pos.z - shooter.pos.z);
      if (d < 2.2) {
        let c = (2.2 - d) * 0.14;
        if (q.isJumping) c *= 1.5;
        contest = Math.max(contest, c);
      }
    }

    const q = base * distFactor + timingBonus - contest + (Math.random() - 0.5) * 0.08;
    return Math.max(0.05, Math.min(0.97, q));
  }

  #isThree(shooter) {
    const hoopX = this.attackHoopX(shooter.teamIdx);
    const dist = Math.hypot(hoopX - shooter.pos.x, shooter.pos.z);
    const cornerZone = Math.abs(shooter.pos.z) > THREE_PT_CORNER - 0.4;
    return dist > (cornerZone ? THREE_PT_CORNER : THREE_PT_R);
  }

  releaseShot(shooter, timingBonus) {
    if (this.ball.holder !== shooter) return;
    const hoopX = this.attackHoopX(shooter.teamIdx);
    shooter.faceToward(hoopX, 0);
    const quality = this.shotQuality(shooter, timingBonus);
    const points = this.#isThree(shooter) ? 3 : 2;
    shooter.startShootPose();
    shooter.jump(3.6);
    this.lastTouchTeam = shooter.teamIdx;
    this.ball.launchShot(shooter, hoopX, quality, points);
  }

  aiShoot(p) {
    if (this.ball.holder !== p || this.state !== 'playing') return;
    // AI timing skill scales with difficulty
    const timing = (Math.random() * 0.14 - 0.02) * this.difficulty.aiShoot;
    this.releaseShot(p, timing);
  }

  doPass(from, to) {
    if (this.ball.holder !== from || !to) return;
    from.faceToward(to.pos.x, to.pos.z);
    this.lastTouchTeam = from.teamIdx;
    this.ball.pass(from, to);
  }

  doSteal(defender, victim) {
    if (this.ball.holder !== victim) return;
    // pokes the ball loose toward the defender's side
    _v.set(defender.pos.x - victim.pos.x, 0, defender.pos.z - victim.pos.z)
      .normalize().multiplyScalar(2.5)
      .add(new THREE.Vector3((Math.random() - 0.5) * 2, 2.0, (Math.random() - 0.5) * 2));
    this.lastTouchTeam = defender.teamIdx;
    this.ball.makeLoose(_v);
    this.ui.showBanner('STEAL!', 900);
    audio.whistle();
  }

  catchBall(p) {
    const ball = this.ball;
    if (ball.state === 'flight' && ball.shot) return;   // no catching a live shot
    const prevPoss = this.possession;
    ball.give(p);
    this.lastTouchTeam = p.teamIdx;
    if (p.teamIdx !== prevPoss) {
      this.setPossession(p.teamIdx);
    } else if (this.reboundTeam === p.teamIdx) {
      this.shotClock = Math.max(this.shotClock, 14);    // offensive board
    }
    this.possession = p.teamIdx;
    this.reboundTeam = -1;
  }

  // ------------------------------------------------------------- events ---

  #onScore(info) {
    const t = info.shooter.teamIdx;
    this.teams[t].score += info.points;
    const nick = this.teams[t].def.nick.toUpperCase();
    const label = info.points === 3
      ? (info.swish ? `${nick} SPLASH A THREE!` : `${nick} FOR THREE!`)
      : (info.swish ? `${nick} — NOTHING BUT NET!` : `${nick} SCORE!`);
    this.ui.showBanner(`+${info.points}  ${label}`, 1600);
    audio.cheer(info.points === 3);

    // opponent inbounds from that baseline after the ball drops through the net
    this.pendingInbound = { team: 1 - t, side: info.hoopSide, t: 0.7 };
  }

  #processInbound(dt) {
    const pi = this.pendingInbound;
    if (!pi) return;
    pi.t -= dt;
    if (pi.t > 0) return;
    this.pendingInbound = null;
    const pg = this.players[pi.team * 5];
    pg.pos.set(pi.side * (COURT_LEN / 2 - 0.8), 0, 2.2);
    this.ball.give(pg);
    this.setPossession(pi.team);
    this.lastTouchTeam = pi.team;
    this.reboundTeam = -1;
  }

  #turnover(toTeam, reason) {
    audio.whistle();
    this.resetFormation(toTeam, reason);
  }

  #endQuarter() {
    audio.buzzer();
    const [h, a] = this.teams;
    if (this.quarter >= QUARTERS && h.score !== a.score) {
      this.state = 'gameover';
      this.ui.showGameOver(this);
      audio.cheer(true);
      return;
    }
    this.quarter++;
    const isOT = this.quarter > QUARTERS;
    this.gameClock = isOT ? 60 : this.quarterLen;
    const nextPoss = (this.quarter + 1) % 2;   // alternate possession
    this.resetFormation(nextPoss, isOT ? 'OVERTIME!' : `END OF Q${this.quarter - 1}`);
  }

  // -------------------------------------------------------------- input ---

  #onKeyDown(code) {
    if (this.state !== 'playing') return;
    const c = this.controlled;
    if (!c) return;
    const onOffense = this.ball.holder === c;

    if (code === 'Space') {
      if (onOffense) {
        this.charging = true;
        this.chargeT = 0;
        this.ui.showMeter();
      } else {
        c.jump(4.6);       // defensive jump / rebound
      }
    }
    if (code === 'KeyE') {
      if (onOffense) {
        const to = this.#bestPassTarget(c);
        if (to) this.doPass(c, to);
      } else if (this.possession === 1 - this.userTeam) {
        this.#switchPlayer();
      }
    }
    if (code === 'KeyQ') {
      const holder = this.ball.holder;
      if (holder && holder.teamIdx !== this.userTeam && c.stealCooldown <= 0) {
        const d = Math.hypot(holder.pos.x - c.pos.x, holder.pos.z - c.pos.z);
        c.stealCooldown = 1.2;
        if (d < 1.4 && Math.random() < 0.4) this.doSteal(c, holder);
      }
    }
  }

  #onKeyUp(code) {
    if (code === 'Space' && this.charging) {
      this.charging = false;
      this.ui.hideMeter();
      if (this.state !== 'playing') return;
      const c = this.controlled;
      if (c && this.ball.holder === c) {
        const meter = Math.min(1, this.chargeT / 1.0);
        // sweet spot centered at 0.77
        const timingBonus = Math.max(-0.30, 0.13 - Math.abs(meter - 0.77) * 1.1);
        this.releaseShot(c, timingBonus);
      }
    }
  }

  #bestPassTarget(from) {
    let best = null, bestScore = -99;
    for (const q of this.players) {
      if (q.teamIdx !== from.teamIdx || q === from) continue;
      let open = 99;
      for (const d of this.players) {
        if (d.teamIdx === from.teamIdx) continue;
        open = Math.min(open, Math.hypot(d.pos.x - q.pos.x, d.pos.z - q.pos.z));
      }
      // prefer open players roughly in the direction we're facing/moving
      const dx = q.pos.x - from.pos.x, dz = q.pos.z - from.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const align = (Math.sin(from.facing) * dx + Math.cos(from.facing) * dz) / dist;
      const score = open * 0.8 + align * 2.2 - dist * 0.08;
      if (score > bestScore) { bestScore = score; best = q; }
    }
    return best;
  }

  #switchPlayer() {
    const ball = this.ball;
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.teamIdx !== this.userTeam || p === this.controlled) continue;
      const d = Math.hypot(p.pos.x - ball.pos.x, p.pos.z - ball.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) this.controlled = best;
  }

  #userMovement(dt) {
    const c = this.controlled;
    if (!c) return;
    let dx = 0, dz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    if (dx || dz) {
      const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      let speed = c.arch.speed * (sprint ? 1.18 : 1.0);
      if (this.charging) speed *= 0.25;   // set feet while loading the shot
      c.moveDir(dx, dz, dt, speed);
      c.pos.x = Math.max(-COURT_LEN / 2 + 0.3, Math.min(COURT_LEN / 2 - 0.3, c.pos.x));
      c.pos.z = Math.max(-COURT_WID / 2 + 0.3, Math.min(COURT_WID / 2 - 0.3, c.pos.z));
    }
    if (this.charging && this.ball.holder === c) {
      c.faceToward(this.attackHoopX(c.teamIdx), 0);
    }
  }

  #updateControlled() {
    const ball = this.ball;
    if (ball.holder && ball.holder.teamIdx === this.userTeam) {
      this.controlled = ball.holder;
    } else if (ball.state === 'pass' && ball.passTarget && ball.passTarget.teamIdx === this.userTeam) {
      this.controlled = ball.passTarget;
    } else if (!this.controlled || (ball.state === 'loose' && this.possession === -1)) {
      this.#switchPlayer();
    }
    for (const p of this.players) p.setControlled(p === this.controlled);
  }

  // -------------------------------------------------------------- frame ---

  update(dt) {
    if (this.state === 'menu' || this.state === 'gameover') return;

    if (this.state === 'dead') {
      this.deadTimer -= dt;
      for (const p of this.players) p.update(dt);
      this.ball.update(dt, this);
      if (this.deadTimer <= 0) this.state = this.deadNext || 'playing';
      this.ui.updateHUD(this);
      return;
    }

    // clocks (freeze while a shot is airborne near quarter end, so buzzer-beaters count)
    this.gameClock -= dt;
    if (this.ball.holder) this.shotClock -= dt;

    this.#processInbound(dt);

    if (this.charging) {
      this.chargeT += dt;
      this.ui.updateMeter(Math.min(1, this.chargeT / 1.0));
    }

    this.#updateControlled();
    this.#userMovement(dt);
    updateAI(this, dt);

    // gentle player-vs-player separation
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i], b = this.players[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.55 * 0.55 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.55 - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }

    for (const p of this.players) p.update(dt);
    this.ball.update(dt, this);

    // loose-ball pickups (not while waiting to inbound a made basket)
    const ball = this.ball;
    if (!this.pendingInbound && (ball.state === 'loose' || ball.state === 'pass')) {
      for (const p of this.players) {
        const d = Math.hypot(p.pos.x - ball.pos.x, p.pos.z - ball.pos.z);
        const reachY = ball.pos.y < 2.1 + p.jumpY;
        if (d < 0.55 && reachY) {
          if (ball.state === 'pass' && p !== ball.passTarget) {
            if (p.teamIdx === ball.passer?.teamIdx) continue;      // teammates let it through
            if (Math.random() > 0.04 * this.difficulty.aiSteal) continue;   // per-frame poke chance
            this.ui.showBanner('INTERCEPTED!', 900);
          }
          this.catchBall(p);
          break;
        }
      }
    }

    // out of bounds (only when the ball is on/near the floor, or way outside)
    const oobX = Math.abs(ball.pos.x) > COURT_LEN / 2 + 0.1;
    const oobZ = Math.abs(ball.pos.z) > COURT_WID / 2 + 0.1;
    const wayOut = Math.abs(ball.pos.x) > COURT_LEN / 2 + 3 || Math.abs(ball.pos.z) > COURT_WID / 2 + 3;
    if (!this.pendingInbound && (ball.state === 'loose' || ball.state === 'pass') &&
        ((oobX || oobZ) && ball.pos.y < 0.6 || wayOut)) {
      this.#turnover(1 - this.lastTouchTeam, 'OUT OF BOUNDS');
      this.ui.updateHUD(this);
      return;
    }

    // shot clock violation
    if (this.shotClock <= 0 && this.possession !== -1 && ball.holder) {
      this.#turnover(1 - this.possession, 'SHOT CLOCK VIOLATION');
      this.ui.updateHUD(this);
      return;
    }

    // end of quarter — wait for any live shot to resolve
    if (this.gameClock <= 0 && !(ball.state === 'flight' && ball.shot)) {
      this.#endQuarter();
    }

    this.ui.updateHUD(this);
  }
}
