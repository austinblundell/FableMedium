import * as THREE from 'three';
import {
  BALL_RADIUS, RIM_HEIGHT, RIM_RADIUS, RIM_TUBE, GRAVITY,
  HOOP_X, BOARD_X, BACKBOARD_W, BACKBOARD_H, BACKBOARD_BOTTOM,
} from './constants.js';
import { audio } from './audio.js';

function makeBallTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#c9541e';
  g.fillRect(0, 0, 256, 128);
  // pebbled leather noise
  for (let i = 0; i < 3500; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
    g.fillRect(Math.random() * 256, Math.random() * 128, 1.5, 1.5);
  }
  // seams
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();       // equator
  for (const x of [0, 128, 256]) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke();       // meridians
  }
  for (const x of [64, 192]) {
    g.beginPath(); g.ellipse(x, 64, 42, 60, 0, 0, Math.PI * 2); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Ball {
  constructor(scene) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 20, 16),
      new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.65 })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.pos = this.mesh.position;
    this.vel = new THREE.Vector3();
    this.spin = new THREE.Vector3();

    this.state = 'loose';         // held | flight | pass | loose
    this.holder = null;
    this.passTarget = null;
    this.passer = null;
    this.dribbleT = 0;

    this.shot = null;             // { shooter, points, quality } while a shot is live
    this.rimTouched = false;
    this.lastBounceSound = 0;

    // callbacks wired by the Game
    this.onScore = null;          // (shotInfo) => {}
    this.onShotMissedDead = null; // called when a shot has clearly missed (ball below rim, descending)

    this.pos.set(0, 1.5, 0);
  }

  give(player) {
    this.state = 'held';
    this.holder = player;
    this.passTarget = null;
    this.passer = null;
    this.shot = null;
    if (player) player.hasBall = true;
    this.vel.set(0, 0, 0);
  }

  release() {
    if (this.holder) this.holder.hasBall = false;
    this.holder = null;
  }

  makeLoose(vel) {
    this.release();
    this.state = 'loose';
    this.passTarget = null;
    this.shot = null;
    if (vel) this.vel.copy(vel);
  }

  // Launch a shot toward a hoop. quality in [0,1] controls aim error.
  launchShot(shooter, hoopX, quality, points) {
    this.release();
    shooter.releasePos(this.pos);
    this.state = 'flight';
    this.rimTouched = false;
    this.shot = { shooter, points, quality };

    // aim error grows as quality drops; biased mostly long/short
    const err = (1 - quality);
    const angle = Math.random() * Math.PI * 2;
    const mag = Math.pow(Math.random(), 0.85) * err * 0.5;
    const tx = hoopX + Math.cos(angle) * mag * 1.15;
    const tz = 0 + Math.sin(angle) * mag;

    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const T = 0.72 + dist * 0.075;          // flight time scales with range
    this.vel.set(dx / T, (RIM_HEIGHT - this.pos.y) / T - 0.5 * GRAVITY * T, dz / T);
    this.spin.set(0, 0, -8);
  }

  pass(from, to, defendersNearLine = 0) {
    this.release();
    from.chestPos(this.pos);
    this.state = 'pass';
    this.passTarget = to;
    this.passer = from;

    // lead the receiver slightly
    _v.set(to.pos.x + to.vel.x * 0.25, 1.3, to.pos.z + to.vel.z * 0.25);
    _v2.subVectors(_v, this.pos);
    const dist = _v2.length();
    const speed = Math.min(16, 9 + dist * 0.9);
    // gentle arc on longer passes
    this.vel.copy(_v2).normalize().multiplyScalar(speed);
    this.vel.y += dist * 0.28;
  }

  update(dt, game) {
    if (this.state === 'held') {
      const h = this.holder;
      if (!h) { this.state = 'loose'; return; }
      if (h.speedNow > 0.4 && !h.isJumping && h.shootTimer <= 0) {
        // dribbling: ball yo-yos between hand and floor beside the player
        this.dribbleT += dt * (5 + h.speedNow * 0.8);
        h.dribblePos(_v);
        const y = Math.abs(Math.sin(this.dribbleT)) * 0.85 + BALL_RADIUS;
        const prevY = this.pos.y;
        this.pos.set(_v.x, y, _v.z);
        if (prevY > y && y < 0.2 && performance.now() - this.lastBounceSound > 220) {
          audio.bounce(0.7);
          this.lastBounceSound = performance.now();
        }
      } else {
        h.chestPos(this.pos);
      }
      this.mesh.rotation.z -= h.speedNow * dt * 2;
      return;
    }

    // free physics: flight / pass / loose
    this.vel.y += GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.rotation.x += this.spin.z * dt;

    // floor bounce
    if (this.pos.y < BALL_RADIUS) {
      this.pos.y = BALL_RADIUS;
      if (Math.abs(this.vel.y) > 0.8) {
        audio.bounce(Math.min(1, Math.abs(this.vel.y) / 7));
        this.vel.y = -this.vel.y * 0.62;
        this.vel.x *= 0.7;
        this.vel.z *= 0.7;
        if (this.state === 'flight') {
          // a shot that reached the floor is dead — rebound time
          const shot = this.shot;
          this.state = 'loose';
          this.shot = null;
          if (shot && this.onShotMissedDead) this.onShotMissedDead(shot);
        }
        if (this.state === 'pass') this.state = 'loose';
      } else {
        this.vel.y = 0;
        this.vel.x *= 0.96;
        this.vel.z *= 0.96;
      }
    }

    if (this.state === 'flight' || this.state === 'loose') {
      this.#collideHoops(dt);
    }

    // pass reception
    if (this.state === 'pass' && this.passTarget) {
      const t = this.passTarget;
      _v.set(t.pos.x, 1.3, t.pos.z);
      if (this.pos.distanceTo(_v) < 0.55) {
        game.catchBall(t);
      }
    }
  }

  #collideHoops(dt) {
    for (const side of [-1, 1]) {
      const hx = side * HOOP_X;
      const ddx = this.pos.x - hx, ddz = this.pos.z;
      const horiz = Math.hypot(ddx, ddz);
      if (horiz > 2 || this.pos.y < 1.8 || this.pos.y > 4.5) {
        // cheap reject unless near this hoop
        if (Math.abs(this.pos.x - side * BOARD_X) > 0.6) continue;
      }

      // --- scoring: crossing the rim plane downward inside the cylinder ---
      const prevY = this.pos.y - this.vel.y * dt;
      if (this.vel.y < 0 && prevY >= RIM_HEIGHT && this.pos.y < RIM_HEIGHT &&
          horiz < RIM_RADIUS - BALL_RADIUS * 0.35) {
        if (this.shot && this.onScore) {
          const info = { ...this.shot, swish: !this.rimTouched, hoopSide: side };
          this.shot = null;
          this.state = 'loose';
          // kill lateral speed so the ball drops through the net
          this.vel.x *= 0.2; this.vel.z *= 0.2; this.vel.y *= 0.55;
          audio.swish();
          this.onScore(info);
        }
        continue;
      }

      // --- rim collision: distance to the torus ring ---
      if (Math.abs(this.pos.y - RIM_HEIGHT) < BALL_RADIUS + RIM_TUBE + 0.05 && horiz < RIM_RADIUS + BALL_RADIUS + 0.1 && horiz > 0.01) {
        // nearest point on rim circle
        const nx = ddx / horiz, nz = ddz / horiz;
        _v.set(hx + nx * RIM_RADIUS, RIM_HEIGHT, nz * RIM_RADIUS);
        _v2.subVectors(this.pos, _v);
        const d = _v2.length();
        if (d < BALL_RADIUS + RIM_TUBE && d > 1e-4) {
          _v2.divideScalar(d);
          this.pos.copy(_v).addScaledVector(_v2, BALL_RADIUS + RIM_TUBE + 0.001);
          const vn = this.vel.dot(_v2);
          if (vn < 0) {
            this.vel.addScaledVector(_v2, -vn * 1.55);   // restitution ~0.55
            this.vel.multiplyScalar(0.85);
            audio.rim();
            this.rimTouched = true;
          }
        }
      }

      // --- backboard collision ---
      const bx = side * BOARD_X;
      const facing = -side;   // board normal points toward center court
      const distToPlane = (this.pos.x - bx) * facing;
      if (distToPlane < BALL_RADIUS && distToPlane > -0.3 &&
          Math.abs(this.pos.z) < BACKBOARD_W / 2 &&
          this.pos.y > BACKBOARD_BOTTOM && this.pos.y < BACKBOARD_BOTTOM + BACKBOARD_H) {
        const vn = this.vel.x * facing;
        if (vn < 0) {
          this.pos.x = bx + facing * BALL_RADIUS;
          this.vel.x = -this.vel.x * 0.55;
          this.vel.y *= 0.9;
          this.vel.z *= 0.9;
          audio.backboard();
          this.rimTouched = true;   // board touch also counts as "not a swish"
        }
      }
    }
  }
}
