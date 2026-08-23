/**
 * DEUSFLOW · CONTINUOUS 3D LIVING WORLD & DAILY PROPHET STORY ENGINE
 * The background is the story: Astral rings, flying gold shards, weaving 3D silk loom,
 * torn parchment photo puzzle assembly, 35mm film ribbons, and exploding/assembling 3D camera.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ==========================================================================
// 1. GLOBAL STATE & TIMELINE PROGRESS
// ==========================================================================
let targetProgress = 0.0;
let currentProgress = 0.0;
let scrollVelocity = 0.0;
let mouseX = 0, mouseY = 0;

let scene, camera, renderer;
let clock = new THREE.Clock();

// Story Entities
let astralRingsGroup;
let goldShardsMesh;
let shardOriginalPositions = [];
let shardTargetPositions0 = [];
let shardTargetPositions1 = [];
let shardTargetPositions2 = [];

let silkLoomGroup;
let photoShardMeshes = [];
let filmStripsGroup;
let cameraGLTFGroup;
let cameraParts = [];
let crimeaPhotoMesh;

// DOM references
const sections = [
  document.getElementById('section-0'),
  document.getElementById('section-1'),
  document.getElementById('section-2')
];
const stepDots = document.querySelectorAll('.step-dot');
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const audioToggle = document.getElementById('audio-toggle');
const audioStatus = document.getElementById('audio-status');

const beatMetadata = [
  { title: 'PROLOGUE // THE INVITATION', timecode: 'FOLIO 01 / 08', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '01 // CRAFT & EMBROIDERY', timecode: 'FOLIO 02 / 08', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '02 // THE FIRST LENS · 35MM', timecode: 'FOLIO 03 / 08', act: 'ACT I // ROOTS & THE FIRST LENS' }
];

// Audio State
let audioCtx = null;
let isAudioActive = false;
let ambientGain = null;

// ==========================================================================
// 2. INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initThreeWorld();
  initGestureEngine();
  initAudio();
  initMouseListener();
});

// ==========================================================================
// 3. THREE.JS SCENE SETUP & ENTITY FACTORY
// ==========================================================================
function initThreeWorld() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x08070b, 0.045);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Lighting
  const keyLight = new THREE.DirectionalLight(0xffeedd, 3.5);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const ambientLight = new THREE.AmbientLight(0x221a28, 1.8);
  scene.add(ambientLight);

  const goldRimLight = new THREE.PointLight(0xd8b888, 4.0, 20);
  goldRimLight.position.set(0, 2, -4);
  scene.add(goldRimLight);

  // Load Studio HDRI
  new RGBELoader().load('/assets/textures/studio_env.hdr', (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
  });

  // Build Scene Entities
  buildAstralRings();
  buildGoldShardsSystem();
  buildSilkLoom();
  buildTornPhotoPuzzle();
  buildFilmRibbons();
  buildCrimeaPhotoPlane();
  load3DVintageCamera();

  // Render Loop
  animate();

  window.addEventListener('resize', onWindowResize);
}

// --------------------------------------------------------------------------
// ENTITY 1: ASTRAL RUNIC RINGS (Beat 0 Background Vortex)
// --------------------------------------------------------------------------
function buildAstralRings() {
  astralRingsGroup = new THREE.Group();
  astralRingsGroup.position.set(0, 0, -6);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8b888,
    emissive: 0x5a3e1b,
    roughness: 0.25,
    metalness: 0.9,
    wireframe: true,
    transparent: true,
    opacity: 0.65
  });

  const r1 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.04, 16, 64), ringMaterial);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.03, 16, 48), ringMaterial);
  const r3 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 16, 36), ringMaterial);

  astralRingsGroup.add(r1, r2, r3);
  scene.add(astralRingsGroup);
}

// --------------------------------------------------------------------------
// ENTITY 2: 3D FLYING GOLD SHARDS SYSTEM (Matter forming words & objects)
// --------------------------------------------------------------------------
const SHARD_COUNT = 1200;

function buildGoldShardsSystem() {
  const shardGeom = new THREE.PlaneGeometry(0.06, 0.06);
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0xfce2b8,
    emissive: 0xd8b888,
    emissiveIntensity: 0.6,
    roughness: 0.15,
    metalness: 0.95,
    side: THREE.DoubleSide
  });

  goldShardsMesh = new THREE.InstancedMesh(shardGeom, shardMat, SHARD_COUNT);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < SHARD_COUNT; i++) {
    // Original deep background vortex position (Beat 0 start)
    const rad = 2.0 + Math.random() * 4.5;
    const theta = Math.random() * Math.PI * 2;
    const z = -4.0 - Math.random() * 12.0;
    const origPos = new THREE.Vector3(Math.cos(theta) * rad, Math.sin(theta) * rad, z);
    shardOriginalPositions.push(origPos);

    // Target 0: Floating arc near title
    const t0 = new THREE.Vector3(
      (Math.random() - 0.5) * 5.5,
      1.0 + (Math.random() - 0.5) * 1.5,
      1.5 + (Math.random() - 0.5) * 1.5
    );
    shardTargetPositions0.push(t0);

    // Target 1: Spiral around Loom & Photo Puzzle
    const t1 = new THREE.Vector3(
      2.1 + Math.cos(theta * 2) * (1.0 + Math.random() * 0.7),
      Math.sin(theta * 2) * (1.0 + Math.random() * 0.7),
      0.5 + (Math.random() - 0.5) * 1.5
    );
    shardTargetPositions1.push(t1);

    // Target 2: Luminous halo around Camera & Crimea Photo
    const t2 = new THREE.Vector3(
      2.1 + (Math.random() - 0.5) * 2.5,
      (Math.random() - 0.5) * 2.5,
      -0.2 + Math.random() * 1.8
    );
    shardTargetPositions2.push(t2);

    dummy.position.copy(origPos);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    goldShardsMesh.setMatrixAt(i, dummy.matrix);
  }

  goldShardsMesh.instanceMatrix.needsUpdate = true;
  scene.add(goldShardsMesh);
}

// --------------------------------------------------------------------------
// ENTITY 3: WEAVING 3D SILK LOOM (Beat 1 Background Threads)
// --------------------------------------------------------------------------
function buildSilkLoom() {
  silkLoomGroup = new THREE.Group();
  silkLoomGroup.position.set(window.innerWidth < 860 ? 0 : 2.1, 0, -2.5);

  const silkMat = new THREE.MeshStandardMaterial({
    color: 0xd8b888,
    emissive: 0x8a6230,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.8,
    transparent: true,
    opacity: 0.0
  });

  for (let i = 0; i < 18; i++) {
    const points = [];
    const radius = 1.4 + (i % 3) * 0.35;
    const height = 4.5;
    const turns = 2.5;

    for (let t = 0; t <= 40; t++) {
      const p = t / 40;
      const angle = p * Math.PI * 2 * turns + (i * Math.PI / 9);
      const x = Math.cos(angle) * radius;
      const y = (p - 0.5) * height;
      const z = Math.sin(angle) * radius * 0.6;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 32, 0.015, 6, false);
    const mesh = new THREE.Mesh(geom, silkMat);
    silkLoomGroup.add(mesh);
  }

  scene.add(silkLoomGroup);
}

// --------------------------------------------------------------------------
// ENTITY 4: 3D TORN PARCHMENT PHOTO PUZZLE (Beat 1 Assembling Picture)
// --------------------------------------------------------------------------
function buildTornPhotoPuzzle() {
  const textureLoader = new THREE.TextureLoader();
  const photoTex = textureLoader.load('/assets/textures/embroidery_threads.jpg');
  photoTex.colorSpace = THREE.SRGBColorSpace;

  const COLS = 3;
  const ROWS = 3;
  const totalWidth = 2.8;
  const totalHeight = 2.1;
  const w = totalWidth / COLS;
  const h = totalHeight / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const geom = new THREE.PlaneGeometry(w * 0.96, h * 0.96);
      
      // Compute sub-UV coordinates for each tile
      const uv = geom.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uv.setXY(i, (c + u) / COLS, (ROWS - 1 - r + v) / ROWS);
      }

      const mat = new THREE.MeshStandardMaterial({
        map: photoTex,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geom, mat);

      // Target assembled position in Beat 1
      const targetPos = new THREE.Vector3(
        (window.innerWidth < 860 ? 0 : 2.1) + (c - 1) * w,
        (window.innerWidth < 860 ? -0.8 : 0) + (1 - r) * h,
        0.5
      );

      // Scatter start position (flown out in 3D)
      const scatterPos = new THREE.Vector3(
        targetPos.x + (Math.random() - 0.5) * 8,
        targetPos.y + (Math.random() - 0.5) * 6,
        targetPos.z + 4 + Math.random() * 6
      );

      const scatterRot = new THREE.Euler(
        (Math.random() - 0.5) * Math.PI,
        (Math.random() - 0.5) * Math.PI,
        (Math.random() - 0.5) * Math.PI
      );

      mesh.position.copy(scatterPos);
      mesh.rotation.copy(scatterRot);
      mesh.userData = {
        targetPos,
        scatterPos,
        scatterRot,
        assembledRot: new THREE.Euler(0, -0.12, 0.02)
      };

      photoShardMeshes.push(mesh);
      scene.add(mesh);
    }
  }
}

// --------------------------------------------------------------------------
// ENTITY 5: 35MM FILM RIBBONS (Beat 2 Background)
// --------------------------------------------------------------------------
function buildFilmRibbons() {
  filmStripsGroup = new THREE.Group();
  filmStripsGroup.position.set(0, 0, -1);

  const filmMat = new THREE.MeshStandardMaterial({
    color: 0x111018,
    emissive: 0x221a28,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide
  });

  for (let i = 0; i < 4; i++) {
    const points = [];
    for (let t = 0; t <= 30; t++) {
      const p = t / 30;
      points.push(new THREE.Vector3(
        (p - 0.5) * 12,
        Math.sin(p * Math.PI * 2 + i) * 2.2,
        Math.cos(p * Math.PI * 3 + i) * 2.0 - 2.0
      ));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 40, 0.12, 4, false);
    const mesh = new THREE.Mesh(geom, filmMat);
    filmStripsGroup.add(mesh);
  }

  scene.add(filmStripsGroup);
}

// --------------------------------------------------------------------------
// ENTITY 6: CRIMEA PHOTO PLANE (Beat 2)
// --------------------------------------------------------------------------
function buildCrimeaPhotoPlane() {
  const tex = new THREE.TextureLoader().load('/assets/textures/crimea_sea.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;

  const geom = new THREE.PlaneGeometry(2.5, 1.75);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.35,
    metalness: 0.15,
    transparent: true,
    opacity: 0.0
  });

  crimeaPhotoMesh = new THREE.Mesh(geom, mat);
  crimeaPhotoMesh.position.set(
    window.innerWidth < 860 ? 0 : 2.1,
    window.innerWidth < 860 ? -1.0 : -0.55,
    0.2
  );
  crimeaPhotoMesh.rotation.set(0.04, -0.15, -0.02);
  scene.add(crimeaPhotoMesh);
}

// --------------------------------------------------------------------------
// ENTITY 7: REAL 3D VINTAGE CAMERA GLTF (Exploding & Reassembling)
// --------------------------------------------------------------------------
function load3DVintageCamera() {
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/assets/models/vintage_camera.glb', (gltf) => {
    cameraGLTFGroup = gltf.scene;

    const box = new THREE.Box3().setFromObject(cameraGLTFGroup);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (window.innerWidth < 860 ? 1.4 : 1.85) / maxDim;
    cameraGLTFGroup.scale.setScalar(scale);

    box.setFromObject(cameraGLTFGroup);
    const center = box.getCenter(new THREE.Vector3());
    cameraGLTFGroup.position.sub(center);

    cameraGLTFGroup.position.set(
      window.innerWidth < 860 ? 0 : 2.1,
      window.innerWidth < 860 ? -1.1 : 0.55,
      -0.4
    );

    cameraGLTFGroup.traverse((child) => {
      if (child.isMesh) {
        child.material.envMapIntensity = 1.8;
        child.material.roughness = Math.min(child.material.roughness, 0.35);

        // Store base position and normal for explosion
        child.userData.basePos = child.position.clone();
        child.userData.explodeVector = new THREE.Vector3(
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5
        );
        cameraParts.push(child);
      }
    });

    cameraGLTFGroup.visible = false;
    scene.add(cameraGLTFGroup);
  });
}

// ==========================================================================
// 4. ANIMATION & TIMELINE INTERPOLATION LOOP
// ==========================================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Smooth lerp progress
  const prevProgress = currentProgress;
  currentProgress += (targetProgress - currentProgress) * 0.08;
  scrollVelocity = (currentProgress - prevProgress) * 60.0;

  // Active Scene Synchronization
  updateActiveSection(currentProgress);

  // 1. Update Astral Rings (Beat 0)
  if (astralRingsGroup) {
    const ringFade = Math.max(0, 1.0 - currentProgress * 3.5);
    astralRingsGroup.rotation.z += 0.003 + scrollVelocity * 0.02;
    astralRingsGroup.rotation.y = mouseX * 0.25;
    astralRingsGroup.children.forEach((r, idx) => {
      r.rotation.x += (idx % 2 === 0 ? 0.004 : -0.004);
      r.material.opacity = ringFade * 0.65;
    });
    astralRingsGroup.visible = ringFade > 0.01;
  }

  // 2. Update Flying Gold Shards (Continuous Morphing Across Beats)
  if (goldShardsMesh) {
    const dummy = new THREE.Object3D();
    const p = currentProgress;

    for (let i = 0; i < SHARD_COUNT; i++) {
      let x, y, z;

      if (p < 0.33) {
        // Morph from deep background into headline area
        const localT = Math.min(1.0, p * 3.5);
        const orig = shardOriginalPositions[i];
        const targ = shardTargetPositions0[i];
        x = THREE.MathUtils.lerp(orig.x, targ.x, localT);
        y = THREE.MathUtils.lerp(orig.y, targ.y, localT) + Math.sin(time * 2 + i) * 0.08;
        z = THREE.MathUtils.lerp(orig.z, targ.z, localT);
      } else if (p < 0.66) {
        // Morph from headline into weaving Loom spiral
        const localT = (p - 0.33) * 3.0;
        const orig = shardTargetPositions0[i];
        const targ = shardTargetPositions1[i];
        x = THREE.MathUtils.lerp(orig.x, targ.x, localT);
        y = THREE.MathUtils.lerp(orig.y, targ.y, localT) + Math.cos(time * 2 + i) * 0.08;
        z = THREE.MathUtils.lerp(orig.z, targ.z, localT);
      } else {
        // Morph into camera and Crimea atmosphere
        const localT = Math.min(1.0, (p - 0.66) * 3.0);
        const orig = shardTargetPositions1[i];
        const targ = shardTargetPositions2[i];
        x = THREE.MathUtils.lerp(orig.x, targ.x, localT);
        y = THREE.MathUtils.lerp(orig.y, targ.y, localT);
        z = THREE.MathUtils.lerp(orig.z, targ.z, localT);
      }

      // Add turbulence from scroll velocity
      x += (Math.random() - 0.5) * Math.abs(scrollVelocity) * 0.4;
      y += (Math.random() - 0.5) * Math.abs(scrollVelocity) * 0.4;

      dummy.position.set(x, y, z);
      dummy.rotation.set(time + i, time * 0.5 + i, 0);
      dummy.updateMatrix();
      goldShardsMesh.setMatrixAt(i, dummy.matrix);
    }
    goldShardsMesh.instanceMatrix.needsUpdate = true;
  }

  // 3. Update Silk Loom (Beat 1)
  if (silkLoomGroup) {
    const loomWeight = Math.sin(Math.max(0, Math.min(1, (currentProgress - 0.2) * 2.5)) * Math.PI);
    silkLoomGroup.rotation.y += 0.008 + scrollVelocity * 0.04;
    silkLoomGroup.children.forEach((mesh) => {
      mesh.material.opacity = loomWeight * 0.8;
    });
    silkLoomGroup.visible = loomWeight > 0.01;
  }

  // 4. Update Torn Parchment Photo Puzzle (Beat 1 Assembly)
  if (photoShardMeshes.length > 0) {
    // Assembles as progress goes from 0.28 to 0.48, disperses when moving past 0.62
    let assembleFactor = 0;
    if (currentProgress >= 0.25 && currentProgress <= 0.65) {
      if (currentProgress < 0.45) {
        assembleFactor = (currentProgress - 0.25) / 0.20;
      } else if (currentProgress <= 0.55) {
        assembleFactor = 1.0;
      } else {
        assembleFactor = 1.0 - (currentProgress - 0.55) / 0.10;
      }
    }
    assembleFactor = Math.max(0, Math.min(1, assembleFactor));

    photoShardMeshes.forEach((mesh) => {
      const u = mesh.userData;
      mesh.position.lerpVectors(u.scatterPos, u.targetPos, assembleFactor);
      
      mesh.rotation.x = THREE.MathUtils.lerp(u.scatterRot.x, u.assembledRot.x, assembleFactor);
      mesh.rotation.y = THREE.MathUtils.lerp(u.scatterRot.y, u.assembledRot.y, assembleFactor);
      mesh.rotation.z = THREE.MathUtils.lerp(u.scatterRot.z, u.assembledRot.z, assembleFactor);

      mesh.material.opacity = assembleFactor;
      mesh.visible = assembleFactor > 0.01;
    });
  }

  // 5. Update Film Strips & Camera & Crimea (Beat 2)
  if (filmStripsGroup) {
    const filmWeight = Math.max(0, (currentProgress - 0.65) * 3.0);
    filmStripsGroup.children.forEach((mesh) => {
      mesh.material.opacity = Math.min(0.65, filmWeight * 0.65);
    });
    filmStripsGroup.visible = filmWeight > 0.01;
  }

  if (cameraGLTFGroup) {
    const camWeight = Math.max(0, (currentProgress - 0.68) * 3.5);
    cameraGLTFGroup.visible = camWeight > 0.05;

    // Explode parts if scrolling with velocity
    const explodeAmount = Math.max(0, 1.0 - Math.min(1.0, (currentProgress - 0.75) * 4.0)) + Math.abs(scrollVelocity) * 0.8;
    cameraParts.forEach((part) => {
      part.position.copy(part.userData.basePos).addScaledVector(part.userData.explodeVector, explodeAmount);
    });

    cameraGLTFGroup.rotation.y = mouseX * 0.35;
    cameraGLTFGroup.rotation.x = mouseY * 0.2;
  }

  if (crimeaPhotoMesh) {
    const crimeaWeight = Math.max(0, Math.min(1, (currentProgress - 0.72) * 3.5));
    crimeaPhotoMesh.material.opacity = crimeaWeight;
    crimeaPhotoMesh.visible = crimeaWeight > 0.01;
  }

  // Mouse Parallax on Camera
  camera.position.x += (mouseX * 0.35 - camera.position.x) * 0.05;
  camera.position.y += (-mouseY * 0.25 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

// ==========================================================================
// 5. GESTURE & PROGRESS CONTROLLER (Continuous Wheel & Touch)
// ==========================================================================
function initGestureEngine() {
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetProgress = Math.max(0.0, Math.min(1.0, targetProgress + e.deltaY * 0.00085));
  }, { passive: false });

  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    const diff = touchStartY - e.touches[0].clientY;
    touchStartY = e.touches[0].clientY;
    targetProgress = Math.max(0.0, Math.min(1.0, targetProgress + diff * 0.0016));
  }, { passive: true });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
      targetProgress = Math.min(1.0, targetProgress + 0.33);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      targetProgress = Math.max(0.0, targetProgress - 0.33);
    }
  });

  // Step Dots Click
  stepDots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      const step = parseInt(e.currentTarget.getAttribute('data-step'), 10);
      targetProgress = step === 0 ? 0.0 : step === 1 ? 0.48 : 0.90;
    });
  });
}

function updateActiveSection(p) {
  let activeIndex = 0;
  if (p < 0.33) {
    activeIndex = 0;
  } else if (p < 0.66) {
    activeIndex = 1;
  } else {
    activeIndex = 2;
  }

  sections.forEach((sec, idx) => {
    sec.classList.toggle('active', idx === activeIndex);
  });

  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === activeIndex);
  });

  const meta = beatMetadata[activeIndex];
  if (hudSceneTitle) hudSceneTitle.textContent = meta.title;
  if (hudTimecode) hudTimecode.textContent = meta.timecode;
  if (hudActLabel) hudActLabel.textContent = meta.act;
}

// ==========================================================================
// 6. MOUSE & RESIZE LISTENERS
// ==========================================================================
function initMouseListener() {
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================================================
// 7. WEB AUDIO SYNTHESIZER
// ==========================================================================
function initAudio() {
  if (!audioToggle) return;

  audioToggle.addEventListener('click', () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;

      ambientGain = audioCtx.createGain();
      ambientGain.gain.value = 0.0;

      whiteNoise.connect(filter);
      filter.connect(ambientGain);
      ambientGain.connect(audioCtx.destination);
      whiteNoise.start();
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();

    isAudioActive = !isAudioActive;
    if (isAudioActive) {
      ambientGain.gain.setTargetAtTime(0.03, audioCtx.currentTime, 0.2);
      audioStatus.textContent = 'SOUND: ON';
    } else {
      ambientGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.2);
      audioStatus.textContent = 'SOUND: OFF';
    }
  });
}
