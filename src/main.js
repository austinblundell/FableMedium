import * as THREE from 'three';
import { buildArena } from './arena.js';
import { Game } from './game.js';
import { initUI } from './ui.js';
import { audio } from './audio.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 9, 17);
camera.lookAt(0, 1, 0);

const { updateJumbotron } = buildArena(scene);
const ui = initUI();
const game = new Game(scene, ui);
ui.bindGame(game);
window.game = game;   // debugging hook

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// audio needs a user gesture
const unlock = () => { audio.init(); audio.resume(); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// ------------------------------------------------- broadcast camera rig ---
const camTarget = new THREE.Vector3(0, 1.2, 0);
const camPos = new THREE.Vector3(0, 9, 17);

function updateCamera(dt) {
  const ball = game.ball;
  // track the ball along the sideline, easing like a TV camera operator
  const followX = THREE.MathUtils.clamp(ball.pos.x * 0.72, -9.5, 9.5);
  camPos.x += (followX - camPos.x) * Math.min(1, dt * 2.2);
  camPos.y = 8.6;
  camPos.z = 16.5;
  camera.position.copy(camPos);

  const lookX = THREE.MathUtils.clamp(ball.pos.x * 0.82, -11, 11);
  camTarget.x += (lookX - camTarget.x) * Math.min(1, dt * 3);
  camTarget.y += (Math.min(ball.pos.y * 0.35 + 0.9, 2.4) - camTarget.y) * Math.min(1, dt * 3);
  camTarget.z = 0;
  camera.lookAt(camTarget);
}

// ----------------------------------------------------------- main loop ---
let last = performance.now();
let jumboTimer = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  game.update(dt);
  updateCamera(dt);

  jumboTimer += dt;
  if (jumboTimer > 0.25 && game.teams.length) {
    jumboTimer = 0;
    updateJumbotron(game);
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
