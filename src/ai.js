import { COURT_LEN, COURT_WID, HOOP_X, THREE_PT_R } from './constants.js';

// Offensive spot layout relative to the attacked hoop (dir = sign of hoop x).
// Indexed by lineup slot: PG, SG, SF, PF, C.
function offenseSpot(slot, dir, out) {
  switch (slot) {
    case 0: out.x = dir * (HOOP_X - 7.6); out.z = 0; break;           // top of key
    case 1: out.x = dir * (HOOP_X - 5.2); out.z = -5.6; break;        // left wing
    case 2: out.x = dir * (HOOP_X - 5.2); out.z = 5.6; break;         // right wing
    case 3: out.x = dir * (HOOP_X - 1.2); out.z = -6.2; break;        // left corner
    case 4: out.x = dir * (HOOP_X - 2.2); out.z = 1.4; break;         // low post
  }
  return out;
}

const _spot = { x: 0, z: 0 };

function nearestOpponentDist(game, p) {
  let best = 99;
  for (const q of game.players) {
    if (q.teamIdx === p.teamIdx) continue;
    const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
    if (d < best) best = d;
  }
  return best;
}

function clampToCourt(p) {
  p.pos.x = Math.max(-COURT_LEN / 2 + 0.4, Math.min(COURT_LEN / 2 - 0.4, p.pos.x));
  p.pos.z = Math.max(-COURT_WID / 2 + 0.4, Math.min(COURT_WID / 2 - 0.4, p.pos.z));
}

function ballHandlerAI(game, p, dt) {
  const dir = game.attackDir(p.teamIdx);
  const hoopX = dir * HOOP_X;
  const distToHoop = Math.hypot(hoopX - p.pos.x, p.pos.z);
  const openness = nearestOpponentDist(game, p);
  const diff = game.difficulty;
  const speed = p.arch.speed * diff.aiSpeed;

  p.decisionTimer -= dt;

  // urgency shooting when the shot clock is dying
  const desperate = game.shotClock < 3;

  const inThree = distToHoop < THREE_PT_R + 1.4 && distToHoop > THREE_PT_R - 0.2;
  const inMid = distToHoop <= 6.5;
  const atRim = distToHoop < 2.2;

  if (desperate && game.shotClock < 1.2) { game.aiShoot(p); return; }

  if (p.decisionTimer <= 0) {
    p.decisionTimer = 0.25 + Math.random() * 0.3;

    // 1. shoot — likelihood scales with openness and spot
    const openBoost = openness > 1.5 ? 1 : openness > 1.1 ? 0.45 : 0.1;
    const wantShot =
      (atRim && Math.random() < 0.7 * Math.max(openBoost, 0.5)) ||
      (inMid && Math.random() < 0.45 * openBoost) ||
      (inThree && Math.random() < 0.5 * p.arch.three * openBoost) ||
      (desperate && distToHoop < 9);
    if (wantShot) { game.aiShoot(p); return; }

    // 2. pass if someone is clearly more open and closer to scoring
    if (openness < 1.0 || Math.random() < 0.14) {
      let best = null, bestScore = 1.1;
      for (const q of game.players) {
        if (q.teamIdx !== p.teamIdx || q === p) continue;
        const qOpen = nearestOpponentDist(game, q);
        const qDist = Math.hypot(hoopX - q.pos.x, q.pos.z);
        const score = qOpen * 0.6 + (distToHoop - qDist) * 0.25 - 0.3;
        if (score > bestScore) { bestScore = score; best = q; }
      }
      if (best) { game.doPass(p, best); return; }
    }

    // 3. re-pick a drive lane and commit to it for a beat
    if (p.driveT === undefined || p.driveT <= 0) {
      const lanes = [0, 3.2, -3.2];
      let bestLane = 0, bestSpace = -1;
      for (const lane of lanes) {
        // sample a point ahead along this lane and measure defender distance
        const px = p.pos.x + dir * 2.5;
        const pz = p.pos.z * 0.5 + lane;
        let space = 99;
        for (const q of game.players) {
          if (q.teamIdx === p.teamIdx) continue;
          space = Math.min(space, Math.hypot(q.pos.x - px, q.pos.z - pz));
        }
        if (space > bestSpace) { bestSpace = space; bestLane = lane; }
      }
      p.driveLane = bestLane;
      p.driveT = 0.9;
    }
  }

  // drive: attack the hoop along the committed lane, straightening out as we near it
  if (p.driveT === undefined) { p.driveT = 0; p.driveLane = 0; }
  p.driveT -= dt;
  const laneBlend = Math.min(1, distToHoop / 8);
  const tx = hoopX - dir * 0.8;
  const tz = (p.driveLane || 0) * laneBlend;
  p.moveToward(tx, tz, dt, speed * 0.97);
  clampToCourt(p);
}

function offBallOffenseAI(game, p, dt) {
  const dir = game.attackDir(p.teamIdx);
  offenseSpot(p.slot, dir, _spot);
  // small personal jitter so movement doesn't look robotic
  if (Math.random() < dt * 0.3) {
    p.spotJitter.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4);
  }
  const speed = p.arch.speed * game.difficulty.aiSpeed * 0.85;
  const d = p.moveToward(_spot.x + p.spotJitter.x, _spot.z + p.spotJitter.y, dt, speed);
  if (d < 0.4) {
    const ball = game.ball;
    p.faceToward(ball.pos.x, ball.pos.z);
  }
  clampToCourt(p);
}

function defenseAI(game, p, dt) {
  const mark = game.players[(1 - p.teamIdx) * 5 + p.slot];   // man-to-man, same slot
  const dir = game.attackDir(1 - p.teamIdx);                 // opponents attack this way
  const hoopX = dir * HOOP_X;
  const diff = game.difficulty;
  const speed = p.arch.speed * diff.aiSpeed * 0.97;

  const markHasBall = game.ball.holder === mark;
  const holder = game.ball.holder;

  // help defense: bigs collapse on a driving ball handler
  let tx, tz;
  const holderThreat = holder && holder.teamIdx !== p.teamIdx &&
    Math.hypot(hoopX - holder.pos.x, holder.pos.z) < 5.5;
  if (holderThreat && !markHasBall && (p.slot === 3 || p.slot === 4)) {
    tx = holder.pos.x + (hoopX - holder.pos.x) * 0.55;
    tz = holder.pos.z * 0.45;
  } else {
    // sag between the mark and our hoop; tighter on the ball
    tx = mark.pos.x + (hoopX - mark.pos.x) * (markHasBall ? 0.22 : 0.38);
    tz = mark.pos.z + (0 - mark.pos.z) * (markHasBall ? 0.18 : 0.38);
  }

  p.moveToward(tx, tz, dt, speed);
  p.faceToward(mark.pos.x, mark.pos.z);
  clampToCourt(p);

  const dToMark = Math.hypot(mark.pos.x - p.pos.x, mark.pos.z - p.pos.z);

  // steal attempts (only against the live dribble)
  if (markHasBall && dToMark < 1.2 && p.stealCooldown <= 0) {
    p.stealCooldown = 1.6;
    if (Math.random() < 0.035 * diff.aiSteal) game.doSteal(p, mark);
  }

  // contest a shot in progress
  if (markHasBall && mark.shootTimer > 0.3 && dToMark < 1.8 && !p.isJumping) {
    p.jump(4.2);
  }
}

function chaseLooseBall(game, dt) {
  const ball = game.ball;
  // the two closest players on each team pursue the ball
  for (const teamIdx of [0, 1]) {
    const chasers = game.players
      .filter(p => p.teamIdx === teamIdx && p !== game.controlled)
      .sort((a, b) =>
        Math.hypot(a.pos.x - ball.pos.x, a.pos.z - ball.pos.z) -
        Math.hypot(b.pos.x - ball.pos.x, b.pos.z - ball.pos.z))
      .slice(0, 2);
    for (const p of chasers) {
      // aim at where the ball is heading
      const lead = 0.3;
      p.moveToward(ball.pos.x + ball.vel.x * lead, ball.pos.z + ball.vel.z * lead,
        dt, p.arch.speed * game.difficulty.aiSpeed);
      p._chasing = true;
    }
  }
}

export function updateAI(game, dt) {
  const ball = game.ball;
  for (const p of game.players) p._chasing = false;

  const looseBall = ball.state === 'loose' ||
    (ball.state === 'flight' && ball.shot === null);
  if (looseBall) chaseLooseBall(game, dt);

  for (const p of game.players) {
    if (p === game.controlled || p._chasing) continue;

    if (game.possession === p.teamIdx && ball.holder) {
      if (ball.holder === p) ballHandlerAI(game, p, dt);
      else offBallOffenseAI(game, p, dt);
    } else if (game.possession === p.teamIdx && ball.state === 'pass') {
      // stay put-ish while the pass is in the air; receiver squares up
      if (ball.passTarget === p) p.faceToward(ball.pos.x, ball.pos.z);
      else offBallOffenseAI(game, p, dt);
    } else if (game.possession !== p.teamIdx && game.possession !== -1) {
      defenseAI(game, p, dt);
    } else {
      // no possession (loose ball, non-chasers): drift toward midcourt-ish spots
      offBallOffenseAI(game, p, dt);
    }
  }
}
