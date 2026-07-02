import * as THREE from 'three';
import {
  COURT_LEN, COURT_WID, RIM_HEIGHT, RIM_RADIUS, RIM_TUBE,
  BOARD_X, HOOP_X, BACKBOARD_W, BACKBOARD_H, BACKBOARD_BOTTOM,
  THREE_PT_R, THREE_PT_CORNER, KEY_W, KEY_L, FT_CIRCLE_R,
  CENTER_CIRCLE_R, RESTRICTED_R,
} from './constants.js';

// ---------------------------------------------------------------------------
// Court floor: hardwood + all regulation markings painted into one big texture.
// ---------------------------------------------------------------------------
function buildCourtTexture() {
  const W = 2048, H = Math.round(W * COURT_WID / COURT_LEN);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const sx = W / COURT_LEN;                       // px per meter
  const mx = m => (m + COURT_LEN / 2) * sx;       // court x -> px
  const mz = m => (m + COURT_WID / 2) * sx;       // court z -> px

  // --- hardwood planks ---
  g.fillStyle = '#c68d4e';
  g.fillRect(0, 0, W, H);
  const plankW = 0.11 * sx;
  for (let x = 0; x < W; x += plankW) {
    const shade = 196 + Math.floor(Math.random() * 34);
    g.fillStyle = `rgb(${shade},${Math.floor(shade * 0.71)},${Math.floor(shade * 0.40)})`;
    g.fillRect(x, 0, plankW - 1, H);
    // plank end seams
    let y = -Math.random() * 200;
    while (y < H) {
      const seg = (1.2 + Math.random() * 1.3) * sx;
      y += seg;
      g.fillStyle = 'rgba(80,50,25,0.35)';
      g.fillRect(x, y, plankW - 1, 2);
    }
  }
  // subtle sheen bands
  const sheen = g.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, W, H);

  // --- painted areas ---
  g.fillStyle = 'rgba(120,30,40,0.85)';           // the paint (both keys)
  g.fillRect(mx(-COURT_LEN / 2), mz(-KEY_W / 2), KEY_L * sx, KEY_W * sx);
  g.fillRect(mx(COURT_LEN / 2 - KEY_L), mz(-KEY_W / 2), KEY_L * sx, KEY_W * sx);

  // --- lines ---
  g.strokeStyle = '#f5f0e6';
  g.lineWidth = 0.05 * sx;
  g.lineCap = 'butt';

  // boundary
  g.strokeRect(mx(-COURT_LEN / 2) + g.lineWidth / 2, mz(-COURT_WID / 2) + g.lineWidth / 2,
    COURT_LEN * sx - g.lineWidth, COURT_WID * sx - g.lineWidth);

  // half court line + circle
  g.beginPath(); g.moveTo(mx(0), 0); g.lineTo(mx(0), H); g.stroke();
  g.beginPath(); g.arc(mx(0), mz(0), CENTER_CIRCLE_R * sx, 0, Math.PI * 2); g.stroke();

  for (const side of [-1, 1]) {
    const hoopPx = mx(side * HOOP_X);
    const basePx = mx(side * COURT_LEN / 2);
    const ftPx = mx(side * (COURT_LEN / 2 - KEY_L));

    // key rectangle
    g.strokeRect(Math.min(basePx, ftPx), mz(-KEY_W / 2), Math.abs(basePx - ftPx), KEY_W * sx);

    // free-throw circle: solid half facing midcourt, dashed half facing baseline
    const midHalf = side > 0 ? [Math.PI / 2, Math.PI * 1.5] : [-Math.PI / 2, Math.PI / 2];
    const baseHalf = side > 0 ? [-Math.PI / 2, Math.PI / 2] : [Math.PI / 2, Math.PI * 1.5];
    g.beginPath();
    g.arc(ftPx, mz(0), FT_CIRCLE_R * sx, midHalf[0], midHalf[1]);
    g.stroke();
    g.setLineDash([0.35 * sx, 0.3 * sx]);
    g.beginPath();
    g.arc(ftPx, mz(0), FT_CIRCLE_R * sx, baseHalf[0], baseHalf[1]);
    g.stroke();
    g.setLineDash([]);

    // restricted arc (opens toward midcourt)
    g.beginPath();
    g.arc(hoopPx, mz(0), RESTRICTED_R * sx, midHalf[0], midHalf[1]);
    g.stroke();

    // three point line: straight corners + arc
    const cornerZ = THREE_PT_CORNER;
    // x extent where arc meets corner line: solve r^2 = dx^2 + cornerZ^2
    const dx = Math.sqrt(Math.max(0, THREE_PT_R * THREE_PT_R - cornerZ * cornerZ));
    const joinPx = mx(side * HOOP_X - side * dx);
    for (const zSign of [-1, 1]) {
      g.beginPath();
      g.moveTo(basePx, mz(zSign * cornerZ));
      g.lineTo(joinPx, mz(zSign * cornerZ));
      g.stroke();
    }
    const a = Math.atan2(cornerZ, dx);          // angle from hoop center
    g.beginPath();
    if (side > 0) g.arc(hoopPx, mz(0), THREE_PT_R * sx, Math.PI - a, Math.PI + a);
    else g.arc(hoopPx, mz(0), THREE_PT_R * sx, -a, a);
    g.stroke();
  }

  // --- center logo ---
  g.save();
  g.translate(mx(0), mz(0));
  g.fillStyle = 'rgba(30,30,60,0.75)';
  g.beginPath(); g.arc(0, 0, CENTER_CIRCLE_R * sx * 0.92, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f5f0e6';
  g.font = `bold ${Math.round(0.62 * sx)}px Arial Black, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.rotate(-Math.PI / 2);
  g.fillText('NBA', 0, -0.28 * sx);
  g.font = `bold ${Math.round(0.34 * sx)}px Arial, sans-serif`;
  g.fillText('SHOWDOWN', 0, 0.32 * sx);
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildHoop(scene, side) {
  const grp = new THREE.Group();
  const dir = side; // +1 hoop at +X

  const steel = new THREE.MeshStandardMaterial({ color: 0x777788, metalness: 0.8, roughness: 0.35 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.9 });

  // stanchion base + arm coming from behind the baseline
  const baseX = dir * (COURT_LEN / 2 + 1.7);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.4), padMat);
  base.position.set(baseX, 0.25, 0);
  grp.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 12), steel);
  pole.position.set(baseX, 1.8, 0);
  grp.add(pole);
  const armLen = Math.abs(baseX - dir * BOARD_X);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, armLen, 10), steel);
  arm.rotation.z = Math.PI / 2;
  arm.position.set((baseX + dir * BOARD_X) / 2, 3.55, 0);
  grp.add(arm);

  // backboard: tempered glass look with white shooter's square
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, BACKBOARD_H, BACKBOARD_W),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.28,
      roughness: 0.05, metalness: 0, transmission: 0.4,
    })
  );
  glass.position.set(dir * BOARD_X, BACKBOARD_BOTTOM + BACKBOARD_H / 2, 0);
  grp.add(glass);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
  const mkStrip = (w, h, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.055, h, w), frameMat);
    m.position.set(dir * BOARD_X, y, z);
    grp.add(m);
  };
  // outer frame
  mkStrip(BACKBOARD_W, 0.05, BACKBOARD_BOTTOM + 0.025, 0);
  mkStrip(BACKBOARD_W, 0.05, BACKBOARD_BOTTOM + BACKBOARD_H - 0.025, 0);
  mkStrip(0.05, BACKBOARD_H, BACKBOARD_BOTTOM + BACKBOARD_H / 2, BACKBOARD_W / 2 - 0.025);
  mkStrip(0.05, BACKBOARD_H, BACKBOARD_BOTTOM + BACKBOARD_H / 2, -BACKBOARD_W / 2 + 0.025);
  // shooter square
  mkStrip(0.61, 0.04, RIM_HEIGHT + 0.45, 0);
  mkStrip(0.61, 0.04, RIM_HEIGHT + 0.02, 0);
  mkStrip(0.04, 0.45, RIM_HEIGHT + 0.235, 0.29);
  mkStrip(0.04, 0.45, RIM_HEIGHT + 0.235, -0.29);

  // rim
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd84315, metalness: 0.6, roughness: 0.4 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS, RIM_TUBE, 10, 32), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(dir * HOOP_X, RIM_HEIGHT, 0);
  grp.add(rim);
  // rim-to-board bracket
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(BOARD_X - HOOP_X), 0.05, 0.1), rimMat);
  bracket.position.set(dir * (HOOP_X + BOARD_X) / 2, RIM_HEIGHT - 0.05, 0);
  grp.add(bracket);

  // net: open-ended tapered cylinder in wireframe reads convincingly as a net
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_RADIUS - 0.01, 0.14, 0.42, 10, 5, true),
    new THREE.MeshBasicMaterial({ color: 0xf8f8f8, wireframe: true, transparent: true, opacity: 0.75 })
  );
  net.position.set(dir * HOOP_X, RIM_HEIGHT - 0.23, 0);
  grp.add(net);

  // stanchion padding
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.9, 0.5), padMat);
  pad.position.set(baseX - dir * 0.05, 1.0, 0);
  grp.add(pad);

  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(grp);
}

function buildStands(scene) {
  const grp = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.95 });
  const ROWS = 14;

  const mkSide = (alongX, sign) => {
    const len = alongX ? COURT_LEN + 22 : COURT_WID + 8;
    const start = alongX ? COURT_WID / 2 + 3.2 : COURT_LEN / 2 + 4.5;
    for (let r = 0; r < ROWS; r++) {
      const depth = 0.95;
      const rise = 0.55;
      const box = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : depth, rise, alongX ? depth : len), seatMat);
      const off = start + r * depth;
      const y = 0.4 + r * rise;
      if (alongX) box.position.set(0, y, sign * off);
      else box.position.set(sign * off, y, 0);
      box.receiveShadow = true;
      grp.add(box);
    }
  };
  mkSide(true, 1); mkSide(true, -1); mkSide(false, 1); mkSide(false, -1);

  // crowd: instanced low-poly spectators
  const crowdGeo = new THREE.CapsuleGeometry(0.16, 0.35, 3, 6);
  const crowdMat = new THREE.MeshLambertMaterial();
  const COUNT = 2600;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, COUNT);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0x8a8fa3, 0x3d4a6b, 0x7a3040, 0xc9b28a, 0x2f5d43, 0xd8d3c7, 0x5b3d6b, 0x965a2e];
  let idx = 0;
  const seatSpots = [];
  for (let r = 0; r < ROWS; r++) {
    const y = 0.4 + r * 0.55 + 0.5;
    for (const sign of [-1, 1]) {
      const off = (COURT_WID / 2 + 3.2) + r * 0.95;
      for (let x = -COURT_LEN / 2 - 9; x < COURT_LEN / 2 + 9; x += 0.55) seatSpots.push([x, y, sign * off]);
      const offE = (COURT_LEN / 2 + 4.5) + r * 0.95;
      for (let z = -COURT_WID / 2 - 3; z < COURT_WID / 2 + 3; z += 0.55) seatSpots.push([sign * offE, y, z]);
    }
  }
  // fill ~ COUNT random occupied seats
  for (let i = seatSpots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seatSpots[i], seatSpots[j]] = [seatSpots[j], seatSpots[i]];
  }
  for (const [x, y, z] of seatSpots) {
    if (idx >= COUNT) break;
    if (Math.random() < 0.18) continue; // empty seats
    dummy.position.set(x + (Math.random() - 0.5) * 0.15, y, z + (Math.random() - 0.5) * 0.15);
    dummy.rotation.y = Math.atan2(-x, -z) + (Math.random() - 0.5) * 0.5;
    dummy.scale.setScalar(0.9 + Math.random() * 0.25);
    dummy.updateMatrix();
    crowd.setMatrixAt(idx, dummy.matrix);
    color.setHex(palette[Math.floor(Math.random() * palette.length)]);
    color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
    crowd.setColorAt(idx, color);
    idx++;
  }
  crowd.count = idx;
  grp.add(crowd);

  scene.add(grp);
}

function buildJumbotron(scene) {
  const grp = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 3.2, 5.4),
    new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.6, metalness: 0.4 })
  );
  frame.position.set(0, 11.5, 0);
  grp.add(frame);

  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.6), screenMat);
    const a = (i * Math.PI) / 2;
    s.position.set(Math.sin(a) * 2.75, 11.5, Math.cos(a) * 2.75);
    s.rotation.y = a;
    s.position.y = 11.5;
    grp.add(s);
  }
  // cables
  const cableMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  for (const [cx, cz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 8), cableMat);
    c.position.set(cx, 17, cz);
    grp.add(c);
  }
  scene.add(grp);

  return function updateJumbotron(game) {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, 512, 256);
    ctx.textAlign = 'center';
    const [h, a] = game.teams;
    ctx.font = 'bold 44px Arial Black, sans-serif';
    ctx.fillStyle = '#' + h.def.color.toString(16).padStart(6, '0');
    ctx.fillRect(20, 30, 150, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(h.def.abbr, 95, 100);
    ctx.fillStyle = '#' + a.def.color.toString(16).padStart(6, '0');
    ctx.fillRect(342, 30, 150, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(a.def.abbr, 417, 100);
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 72px Arial Black, sans-serif';
    ctx.fillText(String(h.score), 95, 185);
    ctx.fillText(String(a.score), 417, 185);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 40px Arial, sans-serif';
    const t = Math.max(0, game.gameClock);
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, 256, 120);
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = '#9ad';
    ctx.fillText(game.quarterLabel(), 256, 60);
    ctx.fillStyle = '#f66';
    ctx.fillText(String(Math.ceil(Math.max(0, game.shotClock))), 256, 190);
    tex.needsUpdate = true;
  };
}

export function buildArena(scene) {
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.Fog(0x05060a, 45, 90);

  // court floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT_LEN, COURT_WID),
    new THREE.MeshStandardMaterial({ map: buildCourtTexture(), roughness: 0.32, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // surrounding apron / arena floor
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT_LEN + 60, COURT_WID + 60),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.012;
  apron.receiveShadow = true;
  scene.add(apron);

  buildHoop(scene, 1);
  buildHoop(scene, -1);
  buildStands(scene);
  const updateJumbotron = buildJumbotron(scene);

  // ------ lighting ------
  scene.add(new THREE.HemisphereLight(0xbcc7ff, 0x1a130a, 0.55));

  const key = new THREE.DirectionalLight(0xfff2dd, 1.9);
  key.position.set(10, 22, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -20; key.shadow.camera.right = 20;
  key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcdd7ff, 0.5);
  fill.position.set(-12, 16, -10);
  scene.add(fill);

  // arena spotlights over each half (no shadows, just pools of light)
  for (const x of [-9, 9]) {
    const spot = new THREE.SpotLight(0xffffff, 350, 45, Math.PI / 5, 0.5, 1.8);
    spot.position.set(x, 16, 0);
    spot.target.position.set(x, 0, 0);
    scene.add(spot, spot.target);
  }

  return { updateJumbotron };
}
