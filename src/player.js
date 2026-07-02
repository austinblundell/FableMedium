import * as THREE from 'three';

const SKIN_TONES = [0xf1c8a5, 0xc98d5f, 0x8d5a3a, 0x5c3a24, 0xe8b48c, 0x74482c];

function makeNumberTexture(number, jersey, trim) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = jersey;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = trim;
  g.font = 'bold 64px Arial Black, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(number), 64, 60);
  g.fillRect(0, 4, 128, 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// An articulated low-poly athlete built from primitives with procedural
// running / shooting / defending animation. Local +Z is forward.
export class Player {
  constructor(scene, teamIdx, slot, teamDef, arch) {
    this.teamIdx = teamIdx;
    this.slot = slot;             // 0..4 (PG..C)
    this.arch = arch;
    this.teamDef = teamDef;

    this.group = new THREE.Group();
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.facing = 0;              // radians; local +Z world direction
    this.speedNow = 0;
    this.phase = Math.random() * Math.PI * 2;

    this.isJumping = false;
    this.vy = 0;
    this.jumpY = 0;

    this.hasBall = false;
    this.shootTimer = 0;          // >0 while in shooting pose
    this.stealCooldown = 0;
    this.decisionTimer = Math.random();
    this.spotJitter = new THREE.Vector2();

    this.#buildBody();
    scene.add(this.group);
  }

  #buildBody() {
    const h = this.arch.height / 1.98;    // scale factor vs base rig
    const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
    const jerseyMat = new THREE.MeshStandardMaterial({
      map: makeNumberTexture(this.arch.number + this.teamIdx * 10, this.teamDef.jersey, this.teamDef.trim),
      roughness: 0.75,
    });
    const shortsMat = new THREE.MeshStandardMaterial({ color: this.teamDef.color, roughness: 0.8 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });

    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 10), jerseyMat);
    torso.position.y = 1.22;
    body.add(torso);

    // hips / shorts
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.21, 0.3, 10), shortsMat);
    shorts.position.y = 0.88;
    body.add(shorts);

    // head + neck
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skinMat);
    head.position.y = 1.75;
    body.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skinMat);
    neck.position.y = 1.6;
    body.add(neck);

    // arms: pivot at shoulders
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    for (const [arm, sx] of [[this.armL, 1], [this.armR, -1]]) {
      arm.position.set(sx * 0.26, 1.5, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 3, 8), skinMat);
      upper.position.y = -0.16;
      arm.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.24, 3, 8), skinMat);
      fore.position.y = -0.44;
      arm.add(fore);
      body.add(arm);
    }

    // legs: pivot at hips
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    for (const [leg, sx] of [[this.legL, 1], [this.legR, -1]]) {
      leg.position.set(sx * 0.11, 0.92, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 3, 8), shortsMat);
      thigh.position.y = -0.2;
      leg.add(thigh);
      const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 3, 8), skinMat);
      calf.position.y = -0.58;
      leg.add(calf);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.26), shoeMat);
      shoe.position.set(0, -0.85, 0.05);
      leg.add(shoe);
      body.add(leg);
    }

    body.scale.setScalar(h);
    body.traverse(o => { if (o.isMesh) o.castShadow = true; });

    // soft blob shadow helper ring for selection (hidden by default)
    const ringGeo = new THREE.RingGeometry(0.34, 0.46, 24);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffe066, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  setControlled(on) { this.ring.visible = on; }

  get height() { return this.arch.height; }
  get reach() { return this.arch.height * 1.33; }

  faceToward(x, z) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    if (dx * dx + dz * dz > 1e-6) this.facing = Math.atan2(dx, dz);
  }

  // Move with acceleration toward a target point. Returns remaining distance.
  moveToward(tx, tz, dt, speed) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) { this.vel.set(0, 0, 0); return dist; }
    const nx = dx / dist, nz = dz / dist;
    this.vel.x = nx * speed;
    this.vel.z = nz * speed;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.facing = Math.atan2(nx, nz);
    return dist;
  }

  moveDir(dx, dz, dt, speed) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) { this.vel.set(0, 0, 0); return; }
    this.vel.x = (dx / len) * speed;
    this.vel.z = (dz / len) * speed;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.facing = Math.atan2(dx, dz);
  }

  jump(power = 4.6) {
    if (this.isJumping) return;
    this.isJumping = true;
    this.vy = power;
  }

  startShootPose(duration = 0.75) {
    this.shootTimer = duration;
  }

  // World-space hand position for holding the ball at the chest.
  chestPos(out) {
    const s = Math.sin(this.facing), c = Math.cos(this.facing);
    out.set(this.pos.x + s * 0.32, this.jumpY + 1.32 * (this.arch.height / 1.98), this.pos.z + c * 0.32);
    return out;
  }

  // Release point above the head for shots.
  releasePos(out) {
    const s = Math.sin(this.facing), c = Math.cos(this.facing);
    const h = this.arch.height / 1.98;
    out.set(this.pos.x + s * 0.15, this.jumpY + 2.05 * h, this.pos.z + c * 0.15);
    return out;
  }

  // Dribble anchor: beside and ahead of the player.
  dribblePos(out) {
    const s = Math.sin(this.facing), c = Math.cos(this.facing);
    const side = this.teamIdx === 0 ? 1 : -1;
    out.set(
      this.pos.x + s * 0.35 + c * 0.28 * side,
      0,
      this.pos.z + c * 0.35 - s * 0.28 * side
    );
    return out;
  }

  update(dt) {
    // vertical (jump) integration
    if (this.isJumping) {
      this.vy -= 12.5 * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.isJumping = false; this.vy = 0; }
    }
    this.group.position.y = this.jumpY;
    this.group.rotation.y = this.facing;

    if (this.stealCooldown > 0) this.stealCooldown -= dt;

    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.speedNow = speed;

    // limb animation
    if (this.shootTimer > 0) {
      this.shootTimer -= dt;
      // both arms up in a follow-through
      const k = 1 - Math.max(0, this.shootTimer / 0.75);
      const lift = -Math.PI * (0.55 + 0.35 * Math.min(1, k * 2));
      this.armL.rotation.x += (lift - this.armL.rotation.x) * Math.min(1, dt * 18);
      this.armR.rotation.x += (lift * 0.9 - this.armR.rotation.x) * Math.min(1, dt * 18);
      this.legL.rotation.x *= 0.85;
      this.legR.rotation.x *= 0.85;
    } else if (speed > 0.3) {
      this.phase += dt * (4.5 + speed * 1.6);
      const swing = Math.min(0.9, 0.35 + speed * 0.09);
      this.legL.rotation.x = Math.sin(this.phase) * swing;
      this.legR.rotation.x = -Math.sin(this.phase) * swing;
      this.armL.rotation.x = -Math.sin(this.phase) * swing * 0.8;
      this.armR.rotation.x = Math.sin(this.phase) * swing * 0.8;
      // slight forward lean when sprinting
      this.body.rotation.x = Math.min(0.18, speed * 0.02);
    } else {
      // settle to idle / defensive stance
      const t = Math.min(1, dt * 8);
      this.legL.rotation.x += (0 - this.legL.rotation.x) * t;
      this.legR.rotation.x += (0 - this.legR.rotation.x) * t;
      const armIdle = this.hasBall ? -0.9 : -0.15;
      this.armL.rotation.x += (armIdle - this.armL.rotation.x) * t;
      this.armR.rotation.x += (armIdle - this.armR.rotation.x) * t;
      this.body.rotation.x *= 0.9;
      this.phase += dt * 1.2;
    }

    // dampen velocity each frame (controllers re-apply it)
    this.vel.multiplyScalar(0.8);
  }
}
