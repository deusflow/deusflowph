/**
 * DEUSFLOW · THE ENCHANTED LIVING FOLIO (ACT 1 ENGINE)
 * "The Daily Prophet" Hogwarts Magic Aesthetic:
 * Kinetic reassembling typography, tactile living parchment, living moving photos, 100vh locked stage.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ==========================================================================
// 1. STATE & GLOBAL VARIABLES
// ==========================================================================
let currentBeat = 0;
let targetBeat = 0;
let isTransitioning = false;
let mouseX = 0, mouseY = 0;

// HUD Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const audioToggle = document.getElementById('audio-toggle');
const audioStatus = document.getElementById('audio-status');
const progressDots = document.querySelectorAll('.progress-dot');

const beats = [
  {
    id: 'beat-0',
    title: 'PROLOGUE // THE INVITATION',
    folio: 'FOLIO 01 / 08',
    act: 'ACT I // ROOTS & THE FIRST LENS'
  },
  {
    id: 'beat-1',
    title: '01 // CRAFT & EMBROIDERY',
    folio: 'FOLIO 02 / 08',
    act: 'ACT I // ROOTS & THE FIRST LENS'
  },
  {
    id: 'beat-2',
    title: '02 // THE FIRST LENS · 35MM',
    folio: 'FOLIO 03 / 08',
    act: 'ACT I // ROOTS & THE FIRST LENS'
  }
];

// Web Audio API
let audioCtx = null;
let isAudioActive = false;
let ambientGain = null;

// ==========================================================================
// 2. INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initKineticTypography();
  initGestureController();
  initMagicParticlesCanvas();
  initAudio();
  initMouseFollow();
  initThreeStage();

  // Reveal Beat 0 on initial load
  setTimeout(() => {
    assembleBeat(0);
  }, 200);
});

// ==========================================================================
// 3. KINETIC DAILY PROPHET TYPOGRAPHY WRAPPER
// ==========================================================================
function initKineticTypography() {
  ['title-0', 'title-1', 'title-2'].forEach((titleId) => {
    const el = document.getElementById(titleId);
    if (!el) return;

    const rawText = el.textContent.trim();
    el.innerHTML = '';

    const words = rawText.split(' ');
    words.forEach((wordText, wIdx) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'kinetic-word';

      const chars = wordText.split('');
      chars.forEach((char, cIdx) => {
        const charSpan = document.createElement('span');
        charSpan.className = 'kinetic-char';
        charSpan.textContent = char;

        // Give each character random 3D trajectory vectors
        const rx = (Math.random() - 0.5) * 80;
        const ry = (Math.random() - 0.5) * 90;
        const rz = (Math.random() - 0.5) * 45;
        const tx = (Math.random() - 0.5) * 60;
        const ty = 40 + Math.random() * 50;
        const tz = -60 - Math.random() * 80;

        charSpan.style.setProperty('--rx', `${rx}deg`);
        charSpan.style.setProperty('--ry', `${ry}deg`);
        charSpan.style.setProperty('--rz', `${rz}deg`);
        charSpan.style.setProperty('--tx', `${tx}px`);
        charSpan.style.setProperty('--ty', `${ty}px`);
        charSpan.style.setProperty('--tz', `${tz}px`);

        wordSpan.appendChild(charSpan);
      });

      el.appendChild(wordSpan);
      if (wIdx < words.length - 1) {
        el.appendChild(document.createTextNode(' '));
      }
    });
  });
}

function assembleBeat(beatIndex) {
  const beat = beats[beatIndex];
  if (!beat) return;

  const beatEl = document.getElementById(beat.id);
  if (!beatEl) return;

  beatEl.classList.add('active');

  // Assemble characters in headline
  const chars = beatEl.querySelectorAll('.kinetic-char');
  chars.forEach((char, idx) => {
    setTimeout(() => {
      char.classList.add('assembled');
    }, 80 + idx * 32);
  });

  // Assemble lead narrative paragraph
  const lead = beatEl.querySelector('.editorial-lead');
  if (lead) {
    setTimeout(() => {
      lead.classList.add('assembled');
    }, 150 + chars.length * 32);
  }

  // Update HUD
  if (hudSceneTitle) hudSceneTitle.textContent = beat.title;
  if (hudTimecode) hudTimecode.textContent = beat.folio;
  if (hudActLabel) hudActLabel.textContent = beat.act;

  // Update Progress Dots
  progressDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === beatIndex);
  });

  // Show/Hide 3D Camera Canvas for Beat 2
  const threeCanvas = document.getElementById('three-canvas');
  if (threeCanvas) {
    threeCanvas.style.opacity = beatIndex === 2 ? '1' : '0';
  }
}

function disassembleBeat(beatIndex, callback) {
  const beat = beats[beatIndex];
  if (!beat) {
    if (callback) callback();
    return;
  }

  const beatEl = document.getElementById(beat.id);
  if (!beatEl) {
    if (callback) callback();
    return;
  }

  const chars = beatEl.querySelectorAll('.kinetic-char');
  chars.forEach((char, idx) => {
    setTimeout(() => {
      char.classList.remove('assembled');
    }, idx * 12);
  });

  const lead = beatEl.querySelector('.editorial-lead');
  if (lead) {
    lead.classList.remove('assembled');
  }

  setTimeout(() => {
    beatEl.classList.remove('active');
    if (callback) callback();
  }, 400);
}

function goToBeat(nextBeat) {
  if (nextBeat === currentBeat || isTransitioning) return;
  if (nextBeat < 0 || nextBeat >= beats.length) return;

  isTransitioning = true;
  targetBeat = nextBeat;

  if (isAudioActive) {
    playParchmentFlipSound();
  }

  disassembleBeat(currentBeat, () => {
    currentBeat = targetBeat;
    assembleBeat(currentBeat);
    setTimeout(() => {
      isTransitioning = false;
    }, 300);
  });
}

// ==========================================================================
// 4. FIXED VIEWPORT GESTURE CONTROLLER (Wheel + Touch + Keyboard)
// ==========================================================================
function initGestureController() {
  let wheelAccumulator = 0;
  let touchStartY = 0;
  let lastGestureTime = 0;

  // Mouse Wheel Gesture
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastGestureTime < 450) return;

    wheelAccumulator += e.deltaY;

    if (wheelAccumulator > 65) {
      wheelAccumulator = 0;
      lastGestureTime = now;
      if (currentBeat < beats.length - 1) {
        goToBeat(currentBeat + 1);
      }
    } else if (wheelAccumulator < -65) {
      wheelAccumulator = 0;
      lastGestureTime = now;
      if (currentBeat > 0) {
        goToBeat(currentBeat - 1);
      }
    }
  }, { passive: false });

  // Touch Swipe Gesture
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    const now = Date.now();
    if (now - lastGestureTime < 450) return;

    if (diff > 45 && currentBeat < beats.length - 1) {
      lastGestureTime = now;
      goToBeat(currentBeat + 1);
    } else if (diff < -45 && currentBeat > 0) {
      lastGestureTime = now;
      goToBeat(currentBeat - 1);
    }
  }, { passive: true });

  // Keyboard Arrow Navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
      if (currentBeat < beats.length - 1) goToBeat(currentBeat + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (currentBeat > 0) goToBeat(currentBeat - 1);
    }
  });

  // Progress Dots Click Handler
  progressDots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      const step = parseInt(e.currentTarget.getAttribute('data-step'), 10);
      goToBeat(step);
    });
  });
}

// ==========================================================================
// 5. 2D CANVAS MAGIC DUST & GOLDEN RUNIC SPARKS
// ==========================================================================
function initMagicParticlesCanvas() {
  const canvas = document.getElementById('magic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const PARTICLE_COUNT = 85;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -0.2 - Math.random() * 0.5,
      size: 1.0 + Math.random() * 2.2,
      baseAlpha: 0.15 + Math.random() * 0.55,
      alpha: 0.2,
      pulseSpeed: 0.02 + Math.random() * 0.03,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  function renderMagicParticles() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx + (mouseX * 0.25);
      p.y += p.vy;
      p.pulsePhase += p.pulseSpeed;

      if (p.y < -10) p.y = height + 10;
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      const currentAlpha = p.baseAlpha + Math.sin(p.pulsePhase) * 0.25;

      // Soft Golden Glow Gradient
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
      grad.addColorStop(0, `rgba(252, 226, 184, ${Math.max(currentAlpha, 0.05)})`);
      grad.addColorStop(0.4, `rgba(216, 184, 136, ${Math.max(currentAlpha * 0.6, 0.02)})`);
      grad.addColorStop(1, 'rgba(216, 184, 136, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(renderMagicParticles);
  }

  renderMagicParticles();

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
}

// ==========================================================================
// 6. THREE.JS 3D VINTAGE CAMERA STAGE (BEAT 2)
// ==========================================================================
let threeScene, threeCamera, threeRenderer, cameraGroup;

function initThreeStage() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  threeCamera.position.set(0, 0, 6.5);

  threeRenderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
  });
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.3;

  const pmremGenerator = new THREE.PMREMGenerator(threeRenderer);
  pmremGenerator.compileEquirectangularShader();

  // Studio Lighting
  const keyLight = new THREE.DirectionalLight(0xffeedd, 3.2);
  keyLight.position.set(3, 5, 4);
  threeScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8cb0d8, 1.4);
  fillLight.position.set(-4, -1, -3);
  threeScene.add(fillLight);

  const rimLight = new THREE.PointLight(0xd8b888, 3.5, 15);
  rimLight.position.set(0, 3, -2);
  threeScene.add(rimLight);

  // Load Studio HDRI
  const rgbeLoader = new RGBELoader();
  rgbeLoader.load('/assets/textures/studio_env.hdr', (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    threeScene.environment = envMap;
    texture.dispose();
  });

  // Load Real Vintage Camera GLTF
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/assets/models/vintage_camera.glb', (gltf) => {
    cameraGroup = gltf.scene;

    const box = new THREE.Box3().setFromObject(cameraGroup);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (window.innerWidth < 860 ? 1.6 : 2.1) / maxDim;
    cameraGroup.scale.setScalar(scale);

    box.setFromObject(cameraGroup);
    const center = box.getCenter(new THREE.Vector3());
    cameraGroup.position.sub(center);

    if (window.innerWidth < 860) {
      cameraGroup.position.set(0, -1.0, 0);
    } else {
      cameraGroup.position.set(1.5, -0.05, 0);
    }

    cameraGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMapIntensity = 1.6;
        child.material.roughness = Math.min(child.material.roughness, 0.35);
      }
    });

    threeScene.add(cameraGroup);
  });

  function animateThree() {
    requestAnimationFrame(animateThree);
    if (cameraGroup) {
      cameraGroup.rotation.y += (mouseX * 0.4 - cameraGroup.rotation.y) * 0.05;
      cameraGroup.rotation.x += (mouseY * 0.2 - cameraGroup.rotation.x) * 0.05;
    }
    threeRenderer.render(threeScene, threeCamera);
  }

  animateThree();

  window.addEventListener('resize', () => {
    if (!threeCamera || !threeRenderer) return;
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ==========================================================================
// 7. MOUSE PARALLAX TRACKER
// ==========================================================================
function initMouseFollow() {
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });
}

// ==========================================================================
// 8. WEB AUDIO SYNTHESIZER (Parchment Rustle & Shutter Sound)
// ==========================================================================
function initAudio() {
  if (!audioToggle) return;

  audioToggle.addEventListener('click', () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      setupAmbientTapeNoise();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isAudioActive = !isAudioActive;
    if (isAudioActive) {
      ambientGain.gain.setTargetAtTime(0.04, audioCtx.currentTime, 0.2);
      audioStatus.textContent = 'SOUND: ON';
      playParchmentFlipSound();
    } else {
      ambientGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.2);
      audioStatus.textContent = 'SOUND: OFF';
    }
  });
}

function setupAmbientTapeNoise() {
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 550;

  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0.0;

  whiteNoise.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  whiteNoise.start();
}

function playParchmentFlipSound() {
  if (!audioCtx || !isAudioActive) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.14);
  gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}
