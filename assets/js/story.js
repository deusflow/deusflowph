/**
 * DEUSFLOW · NIGHT IN THE HOGWARTS LIBRARY
 * Pure Parchment & Ink Shard Metamorphosis Engine
 * Single focal point ritual of assembly:
 * - 60 dust motes floating quietly in the gothic window light beam
 * - 30,000 shards of cream parchment (#e8dcc0) & blue-black ink (#1a1f2e) with gold edge-glow
 * - Form assembly with ink-manifestation settling pulse
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const SHARD_COUNT = 30000;
const DUST_COUNT = 70;

let scene, camera, renderer;
let clock = new THREE.Clock();

let shardsGeometry, shardsMaterial, shardsMesh;
let dustGeometry, dustMaterial, dustMesh;

let targetProgress = 0.0;
let currentProgress = 0.0;
let scrollVelocity = 0.0;
let mouseX = 0, mouseY = 0;

// DOM Elements
const cards = [
  document.getElementById('card-0'),
  document.getElementById('card-1'),
  document.getElementById('card-2')
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

let audioCtx = null;
let isAudioActive = false;
let ambientGain = null;

// ==========================================================================
// 1. INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (document.fonts) {
    await document.fonts.ready;
  }
  initThree();
  buildDustMotes();
  await buildParchmentInkShards();
  initGestureEngine();
  initAudio();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8.0);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  window.addEventListener('resize', onWindowResize);
}

// ==========================================================================
// 2. DUST MOTES IN WINDOW LIGHT BEAM (60-80 particles)
// ==========================================================================
function buildDustMotes() {
  dustGeometry = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustVel = new Float32Array(DUST_COUNT * 3);

  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 8.0 - 1.5;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 6.0 + 1.0;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4.0;

    dustVel[i * 3 + 0] = (Math.random() - 0.5) * 0.002;
    dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
    dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  }

  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeometry.setAttribute('aVelocity', new THREE.BufferAttribute(dustVel, 3));

  dustMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uTime;
      attribute vec3 aVelocity;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.4 + position.y * 2.0) * 0.15;
        p.y += cos(uTime * 0.3 + position.x * 2.0) * 0.15;
        p.z += sin(uTime * 0.2 + position.z * 2.0) * 0.10;

        vAlpha = 0.35 + 0.25 * sin(uTime * 0.8 + position.x * 4.0);

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (18.0 / -mvPosition.z);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(0.96, 0.88, 0.74, core * vAlpha * 0.45);
      }
    `,
    uniforms: {
      uTime: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  dustMesh = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dustMesh);
}

// ==========================================================================
// 3. PARCHMENT & INK SAMPLERS
// ==========================================================================
function sampleCyrillicTextToPoints(lines, count, bounds) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1600;
  canvas.height = 800;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize = lines.length === 1 ? 160 : 130;
  ctx.font = `bold ${fontSize}px "Playfair Display", serif`;

  const lineHeight = fontSize * 1.25;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const validPixels = [];

  for (let y = 0; y < canvas.height; y += 3) {
    for (let x = 0; x < canvas.width; x += 3) {
      if (imgData[(y * canvas.width + x) * 4] > 100) {
        validPixels.push({
          x: (x / canvas.width - 0.5) * bounds.width + bounds.x,
          y: (-(y / canvas.height - 0.5)) * bounds.height + bounds.y
        });
      }
    }
  }

  const points = new Float32Array(count * 3);
  const totalValid = validPixels.length || 1;

  for (let i = 0; i < count; i++) {
    const p = validPixels[i % totalValid] || { x: 0, y: 0 };
    points[i * 3 + 0] = p.x + (Math.random() - 0.5) * 0.035;
    points[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.035;
    points[i * 3 + 2] = bounds.z + (Math.random() - 0.5) * 0.08;
  }
  return points;
}

async function sampleImageToPoints(imgSrc, count, bounds) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 240;
      canvas.height = 180;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      const points = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      const aspect = canvas.width / canvas.height;
      const w = bounds.width;
      const h = bounds.width / aspect;

      for (let i = 0; i < count; i++) {
        const px = Math.floor(Math.random() * canvas.width);
        const py = Math.floor(Math.random() * canvas.height);
        const idx = (py * canvas.width + px) * 4;

        points[i * 3 + 0] = ((px / canvas.width) - 0.5) * w + bounds.x;
        points[i * 3 + 1] = (-((py / canvas.height) - 0.5)) * h + bounds.y;
        points[i * 3 + 2] = bounds.z + (Math.random() - 0.5) * 0.08;

        colors[i * 3 + 0] = Math.min(1.0, (imgData[idx] / 255.0) * 1.35);
        colors[i * 3 + 1] = Math.min(1.0, (imgData[idx + 1] / 255.0) * 1.35);
        colors[i * 3 + 2] = Math.min(1.0, (imgData[idx + 2] / 255.0) * 1.35);
      }
      resolve({ points, colors });
    };
    img.onerror = () => {
      resolve({
        points: new Float32Array(count * 3),
        colors: new Float32Array(count * 3).fill(1.0)
      });
    };
    img.src = imgSrc;
  });
}

async function sampleGLTFModel(gltfPath, count, bounds) {
  return new Promise((resolve) => {
    new GLTFLoader().load(gltfPath, (gltf) => {
      const meshes = [];
      gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.updateWorldMatrix(true, false);
          meshes.push(child);
        }
      });

      const points = new Float32Array(count * 3);
      if (meshes.length === 0) {
        resolve(points);
        return;
      }

      const samplers = meshes.map(m => new MeshSurfaceSampler(m).build());
      const tempPos = new THREE.Vector3();

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = bounds.scale / maxDim;

      for (let i = 0; i < count; i++) {
        const s = samplers[i % samplers.length];
        s.sample(tempPos);
        tempPos.sub(center);
        points[i * 3 + 0] = tempPos.x * scale + bounds.x;
        points[i * 3 + 1] = tempPos.y * scale + bounds.y;
        points[i * 3 + 2] = tempPos.z * scale + bounds.z;
      }
      resolve(points);
    }, undefined, () => {
      resolve(new Float32Array(count * 3));
    });
  });
}

// ==========================================================================
// 4. BUILD PARCHMENT & INK LIVING SHARD SYSTEM
// ==========================================================================
async function buildParchmentInkShards() {
  shardsGeometry = new THREE.BufferGeometry();

  // 1. Initial Floating Cloud (Quiet hovering state before incantation)
  const posQuiet = new Float32Array(SHARD_COUNT * 3);
  const shardTypes = new Float32Array(SHARD_COUNT);
  const randomAttrs = new Float32Array(SHARD_COUNT * 4);

  for (let i = 0; i < SHARD_COUNT; i++) {
    posQuiet[i * 3 + 0] = (Math.random() - 0.5) * 12.0;
    posQuiet[i * 3 + 1] = (Math.random() - 0.5) * 8.0;
    posQuiet[i * 3 + 2] = (Math.random() - 0.5) * 8.0 - 1.5;

    // Shard Matter Types:
    // 0.0 - 0.50: Cream Parchment
    // 0.50 - 0.85: Blue-Black Archival Ink
    // 0.85 - 1.00: Enchanted Gold Leaf
    shardTypes[i] = Math.random();

    randomAttrs[i * 4 + 0] = Math.random();
    randomAttrs[i * 4 + 1] = Math.random();
    randomAttrs[i * 4 + 2] = Math.random();
    randomAttrs[i * 4 + 3] = Math.random();
  }

  // 2. Target 0: Cyrillic headline «ПРИСТЕБНІТЬ РЕМЕНІ.» (Single focal point Center-Top)
  const posText0 = sampleCyrillicTextToPoints(['ПРИСТЕБНІТЬ', 'РЕМЕНІ.'], SHARD_COUNT, {
    x: 0,
    y: 0.95,
    z: 0.2,
    width: 6.8,
    height: 3.2
  });

  // 3. Target 1: Archival Childhood Craft Photograph
  const photo1Data = await sampleImageToPoints('/assets/textures/embroidery_threads.jpg', SHARD_COUNT, {
    x: 0,
    y: 0.75,
    z: 0.2,
    width: 5.2
  });

  // 4. Target 2: 3D Vintage Camera GLTF + Crimea Sea Photo
  const CAMERA_COUNT = 17000;
  const CRIMEA_COUNT = SHARD_COUNT - CAMERA_COUNT;

  const cameraPoints = await sampleGLTFModel('/assets/models/vintage_camera.glb', CAMERA_COUNT, {
    x: -1.7,
    y: 0.55,
    z: 0.0,
    scale: 2.0
  });

  const crimeaData = await sampleImageToPoints('/assets/textures/crimea_sea.jpg', CRIMEA_COUNT, {
    x: 1.7,
    y: 0.55,
    z: 0.2,
    width: 3.6
  });

  const posObject2 = new Float32Array(SHARD_COUNT * 3);
  const colorObject2 = new Float32Array(SHARD_COUNT * 3);

  for (let i = 0; i < CAMERA_COUNT; i++) {
    posObject2[i * 3 + 0] = cameraPoints[i * 3 + 0];
    posObject2[i * 3 + 1] = cameraPoints[i * 3 + 1];
    posObject2[i * 3 + 2] = cameraPoints[i * 3 + 2];

    colorObject2[i * 3 + 0] = 0.94;
    colorObject2[i * 3 + 1] = 0.85;
    colorObject2[i * 3 + 2] = 0.68;
  }
  for (let i = 0; i < CRIMEA_COUNT; i++) {
    const srcIdx = i * 3;
    const dstIdx = (CAMERA_COUNT + i) * 3;
    posObject2[dstIdx + 0] = crimeaData.points[srcIdx + 0];
    posObject2[dstIdx + 1] = crimeaData.points[srcIdx + 1];
    posObject2[dstIdx + 2] = crimeaData.points[srcIdx + 2];

    colorObject2[dstIdx + 0] = crimeaData.colors[srcIdx + 0];
    colorObject2[dstIdx + 1] = crimeaData.colors[srcIdx + 1];
    colorObject2[dstIdx + 2] = crimeaData.colors[srcIdx + 2];
  }

  // Set Buffer Attributes
  shardsGeometry.setAttribute('position', new THREE.BufferAttribute(posQuiet, 3));
  shardsGeometry.setAttribute('aTargetText0', new THREE.BufferAttribute(posText0, 3));
  shardsGeometry.setAttribute('aTargetPhoto1', new THREE.BufferAttribute(photo1Data.points, 3));
  shardsGeometry.setAttribute('aColorPhoto1', new THREE.BufferAttribute(photo1Data.colors, 3));
  shardsGeometry.setAttribute('aTargetObject2', new THREE.BufferAttribute(posObject2, 3));
  shardsGeometry.setAttribute('aColorObject2', new THREE.BufferAttribute(colorObject2, 3));
  shardsGeometry.setAttribute('aShardType', new THREE.BufferAttribute(shardTypes, 1));
  shardsGeometry.setAttribute('aRandom', new THREE.BufferAttribute(randomAttrs, 4));

  // Custom Parchment, Ink & Gold Edge-Glow Shader
  shardsMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uProgress;
      uniform float uVelocity;
      uniform float uTime;

      attribute vec3 aTargetText0;
      attribute vec3 aTargetPhoto1;
      attribute vec3 aColorPhoto1;
      attribute vec3 aTargetObject2;
      attribute vec3 aColorObject2;
      attribute float aShardType;
      attribute vec4 aRandom;

      varying vec3 vColor;
      varying float vShardType;
      varying float vAlpha;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      vec3 curl(vec3 p) {
        float e = 0.1;
        float dx = snoise(p + vec3(e, 0.0, 0.0)) - snoise(p - vec3(e, 0.0, 0.0));
        float dy = snoise(p + vec3(0.0, e, 0.0)) - snoise(p - vec3(0.0, e, 0.0));
        float dz = snoise(p + vec3(0.0, 0.0, e)) - snoise(p - vec3(0.0, 0.0, e));
        return vec3(dy - dz, dz - dx, dx - dy) / (2.0 * e);
      }

      void main() {
        vec3 p0 = position;            // Quiet hovering state
        vec3 p1 = aTargetText0;        // Text 0 («ПРИСТЕБНІТЬ РЕМЕНІ.»)
        vec3 p2 = aTargetPhoto1;       // Photo 1 (Crafts)
        vec3 p3 = aTargetObject2;      // Camera & Crimea

        // Shard Palette:
        // 50% Cream Parchment: #e8dcc0 (0.93, 0.88, 0.78)
        // 35% Blue-Black Ink:  #1a1f2e (0.12, 0.14, 0.22)
        // 15% Enchanted Gold:  #fce2b8 (1.00, 0.90, 0.74)
        vec3 baseColor;
        if (aShardType < 0.50) {
          baseColor = vec3(0.93, 0.88, 0.78);
        } else if (aShardType < 0.85) {
          baseColor = vec3(0.14, 0.16, 0.24);
        } else {
          baseColor = vec3(1.00, 0.90, 0.74);
        }

        vec3 currentPos = p0;
        vec3 targetColor = baseColor;
        float morphArc = 0.0;

        float p = uProgress;

        // Stage 0: Quiet -> Text 0 (p in 0.00 -> 0.15)
        if (p <= 0.15) {
          float t = smoothstep(0.0, 0.12, p);
          currentPos = mix(p0, p1, t);
          targetColor = baseColor;
          morphArc = sin(t * 3.14159265) * step(t, 0.98);
        }
        // Stage 1: Text 0 -> Photo 1 (p in 0.15 -> 0.50)
        else if (p <= 0.50) {
          float t = smoothstep(0.18, 0.42, p);
          currentPos = mix(p1, p2, t);
          targetColor = mix(baseColor, aColorPhoto1, smoothstep(0.2, 0.85, t));
          morphArc = sin(t * 3.14159265) * step(t, 0.98);
        }
        // Stage 2: Photo 1 -> Camera & Crimea (p in 0.50 -> 1.00)
        else {
          float t = smoothstep(0.55, 0.88, p);
          currentPos = mix(p2, p3, t);
          targetColor = mix(aColorPhoto1, aColorObject2, smoothstep(0.2, 0.85, t));
          morphArc = sin(t * 3.14159265) * step(t, 0.98);
        }

        // Soft breathing pulsation when resting in place
        if (morphArc < 0.05 && abs(uVelocity) < 0.05) {
          currentPos += vec3(sin(uTime * 1.5 + currentPos.y) * 0.015, cos(uTime * 1.5 + currentPos.x) * 0.015, 0.0);
        }

        // Curl turbulence active during fast motion & transition arcs
        float velTurbulence = clamp(abs(uVelocity) * 1.5, 0.0, 3.5);
        float totalTurbulence = morphArc * 1.35 + velTurbulence;
        
        vec3 noiseVec = curl(currentPos * 0.4 + vec3(uTime * 0.2) + aRandom.xyz * 0.5);
        currentPos += noiseVec * (totalTurbulence * 0.42);

        vColor = targetColor;
        vShardType = aShardType;
        vAlpha = 0.98;

        vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Enhanced point size for crisp manuscript clarity
        gl_PointSize = (32.0 / -mvPosition.z) * (1.0 + totalTurbulence * 0.3);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vShardType;
      varying float vAlpha;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        // Rich dual-tone manuscript shard with gold rim
        float rim = smoothstep(0.28, 0.48, dist);
        vec3 goldRim = vec3(0.98, 0.88, 0.70);
        vec3 finalColor = mix(vColor, goldRim, rim * 0.45);

        float alphaMask = 1.0 - smoothstep(0.42, 0.5, dist);
        gl_FragColor = vec4(finalColor, alphaMask * vAlpha);
      }
    `,
    uniforms: {
      uProgress: { value: 0.0 },
      uVelocity: { value: 0.0 },
      uTime: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  shardsMesh = new THREE.Points(shardsGeometry, shardsMaterial);
  scene.add(shardsMesh);
}

// ==========================================================================
// 5. ANIMATION LOOP
// ==========================================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  const prevProgress = currentProgress;
  currentProgress += (targetProgress - currentProgress) * 0.08;
  scrollVelocity = (currentProgress - prevProgress) * 60.0;

  if (shardsMaterial) {
    shardsMaterial.uniforms.uProgress.value = currentProgress;
    shardsMaterial.uniforms.uVelocity.value = scrollVelocity;
    shardsMaterial.uniforms.uTime.value = time;
  }

  if (dustMaterial) {
    dustMaterial.uniforms.uTime.value = time;
  }

  updateActiveCard(currentProgress);

  camera.position.x += (mouseX * 0.25 - camera.position.x) * 0.05;
  camera.position.y += (-mouseY * 0.20 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

// ==========================================================================
// 6. GESTURE & PROGRESS CONTROLLER
// ==========================================================================
function initGestureEngine() {
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetProgress = Math.max(0.0, Math.min(1.0, targetProgress + e.deltaY * 0.00075));
  }, { passive: false });

  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    const diff = touchStartY - e.touches[0].clientY;
    touchStartY = e.touches[0].clientY;
    targetProgress = Math.max(0.0, Math.min(1.0, targetProgress + diff * 0.0015));
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
      targetProgress = Math.min(1.0, targetProgress + 0.33);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      targetProgress = Math.max(0.0, targetProgress - 0.33);
    }
  });

  stepDots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      const step = parseInt(e.currentTarget.getAttribute('data-step'), 10);
      targetProgress = step === 0 ? 0.14 : step === 1 ? 0.42 : 0.92;
    });
  });
}

function updateActiveCard(p) {
  let activeIndex = 0;
  if (p < 0.28) {
    activeIndex = 0;
  } else if (p < 0.65) {
    activeIndex = 1;
  } else {
    activeIndex = 2;
  }

  cards.forEach((card, idx) => {
    card.classList.toggle('active', idx === activeIndex);
  });

  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === activeIndex);
  });

  const meta = beatMetadata[activeIndex];
  if (hudSceneTitle) hudSceneTitle.textContent = meta.title;
  if (hudTimecode) hudTimecode.textContent = meta.timecode;
  if (hudActLabel) hudActLabel.textContent = meta.act;
}

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
