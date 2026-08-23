/**
 * DEUSFLOW · NIGHT IN THE HOGWARTS LIBRARY
 * Pure 3D InstancedMesh Torn Parchment & Ink Shard Engine
 * Architecture:
 * - 500 Physical 3D Polygonal Paper Scraps (THREE.InstancedMesh)
 * - Double-Sided Paper Shading, 3D Tumbling Rotations & Ragged Gold Edge Contours
 * - Multi-Target Sampling (Cyrillic Glyphs, 3D Photo Grid, 3D GLTF Camera Model)
 * - 70 Ambient Dust Motes in Gothic Window Light Beam
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const INSTANCE_COUNT = 500;
const DUST_COUNT = 70;

let scene, camera, renderer;
let clock = new THREE.Clock();

let shardsMesh, shardsMaterial, shardsGeometry;
let dustMesh, dustMaterial, dustGeometry;

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
  await buildTornParchmentInstancedShards();
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
// 2. DUST MOTES IN WINDOW LIGHT BEAM (Ambient Context)
// ==========================================================================
function buildDustMotes() {
  dustGeometry = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);

  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 8.0 - 1.5;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 6.0 + 1.0;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4.0;
  }

  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

  dustMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uTime;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.35 + position.y * 2.0) * 0.12;
        p.y += cos(uTime * 0.25 + position.x * 2.0) * 0.12;
        p.z += sin(uTime * 0.20 + position.z * 2.0) * 0.08;

        vAlpha = 0.30 + 0.20 * sin(uTime * 0.8 + position.x * 4.0);

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (16.0 / -mvPosition.z);
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
// 3. TARGET SAMPLERS FOR PHYSICAL SHARDS
// ==========================================================================

// Sample Cyrillic text contours cleanly for physical paper scraps
function sampleTextForShards(lines, count, bounds) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1800;
  canvas.height = 700;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize = 150;
  ctx.font = `900 ${fontSize}px "Playfair Display", Georgia, serif`;

  const lineHeight = fontSize * 1.35;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const strokePixels = [];

  // Edge & interior sampling for distinct letterform coverage
  for (let y = 0; y < canvas.height; y += 6) {
    for (let x = 0; x < canvas.width; x += 6) {
      const idx = (y * canvas.width + x) * 4;
      if (imgData[idx] > 140) {
        strokePixels.push({
          x: (x / canvas.width - 0.5) * bounds.width + bounds.x,
          y: (-(y / canvas.height - 0.5)) * bounds.height + bounds.y
        });
      }
    }
  }

  const positions = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 3);
  const total = strokePixels.length || 1;

  for (let i = 0; i < count; i++) {
    const stepIdx = Math.floor((i / count) * total);
    const p = strokePixels[stepIdx] || { x: 0, y: 0 };

    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = bounds.z + (Math.random() - 0.5) * 0.02;

    rotations[i * 3 + 0] = (Math.random() - 0.5) * 0.04;
    rotations[i * 3 + 1] = (Math.random() - 0.5) * 0.04;
    rotations[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
  }
  return { positions, rotations };
}

// Sample a grid of physical photo scraps with UV coordinates
function samplePhotoForShards(count, bounds, cols = 25, rows = 20) {
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const rotations = new Float32Array(count * 3);

  const cellW = bounds.width / cols;
  const cellH = bounds.height / rows;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const u = (col + 0.5) / cols;
    const v = (row + 0.5) / rows;

    positions[i * 3 + 0] = (col - cols / 2 + 0.5) * cellW + bounds.x;
    positions[i * 3 + 1] = (row - rows / 2 + 0.5) * cellH + bounds.y;
    positions[i * 3 + 2] = bounds.z + (Math.random() - 0.5) * 0.02;

    uvs[i * 2 + 0] = u;
    uvs[i * 2 + 1] = 1.0 - v;

    rotations[i * 3 + 0] = (Math.random() - 0.5) * 0.02;
    rotations[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
    rotations[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
  }
  return { positions, uvs, rotations };
}

// Sample surface points of a compound GLTF model for shards
async function sampleGLTFForShards(gltfPath, count, bounds) {
  return new Promise((resolve) => {
    new GLTFLoader().load(gltfPath, (gltf) => {
      const meshes = [];
      gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.updateWorldMatrix(true, false);
          meshes.push(child);
        }
      });

      const positions = new Float32Array(count * 3);
      const rotations = new Float32Array(count * 3);

      if (meshes.length === 0) {
        resolve({ positions, rotations });
        return;
      }

      const samplers = meshes.map(m => new MeshSurfaceSampler(m).build());
      const tempPos = new THREE.Vector3();
      const tempNorm = new THREE.Vector3();

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
      const scale = bounds.scale / maxDim;

      for (let i = 0; i < count; i++) {
        const s = samplers[i % samplers.length];
        s.sample(tempPos, tempNorm);
        tempPos.sub(center);

        positions[i * 3 + 0] = tempPos.x * scale + bounds.x;
        positions[i * 3 + 1] = tempPos.y * scale + bounds.y;
        positions[i * 3 + 2] = tempPos.z * scale + bounds.z;

        rotations[i * 3 + 0] = tempNorm.x;
        rotations[i * 3 + 1] = tempNorm.y;
        rotations[i * 3 + 2] = tempNorm.z;
      }
      resolve({ positions, rotations });
    }, undefined, () => {
      resolve({
        positions: new Float32Array(count * 3),
        rotations: new Float32Array(count * 3)
      });
    });
  });
}

// ==========================================================================
// 4. BUILD INSTANCED MESH TORN PARCHMENT SHARD UNIVERSE
// ==========================================================================
async function buildTornParchmentInstancedShards() {
  // Base Geometry: Torn Ragged Polygonal Quad with 4 Displaced Vertices
  // Including edge coordinates for physical gold edge highlight
  const baseGeom = new THREE.BufferGeometry();
  
  // 4 vertices of a ragged quadrilateral
  const verts = new Float32Array([
    -0.52, -0.48, 0.0,
     0.49, -0.51, 0.0,
     0.51,  0.49, 0.0,
    -0.48,  0.52, 0.0
  ]);

  const normals = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ]);

  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ]);

  // Distance from center to compute perimeter gold foil edge
  const edgeDist = new Float32Array([
    1.0, 1.0, 1.0, 1.0
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3
  ]);

  baseGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  baseGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  baseGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  baseGeom.setAttribute('aEdge', new THREE.BufferAttribute(edgeDist, 1));
  baseGeom.setIndex(new THREE.BufferAttribute(indices, 1));

  shardsGeometry = new THREE.InstancedBufferGeometry();
  shardsGeometry.index = baseGeom.index;
  shardsGeometry.attributes.position = baseGeom.attributes.position;
  shardsGeometry.attributes.normal = baseGeom.attributes.normal;
  shardsGeometry.attributes.uv = baseGeom.attributes.uv;
  shardsGeometry.attributes.aEdge = baseGeom.attributes.aEdge;

  // 1. Initial State 0: Quiet Hovering in Deep Space
  const posQuiet = new Float32Array(INSTANCE_COUNT * 3);
  const rotQuiet = new Float32Array(INSTANCE_COUNT * 3);
  const shardTypes = new Float32Array(INSTANCE_COUNT);
  const shardScales = new Float32Array(INSTANCE_COUNT * 2);
  const randomAttrs = new Float32Array(INSTANCE_COUNT * 4);

  for (let i = 0; i < INSTANCE_COUNT; i++) {
    posQuiet[i * 3 + 0] = (Math.random() - 0.5) * 8.5;
    posQuiet[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
    posQuiet[i * 3 + 2] = (Math.random() - 0.5) * 6.0 - 1.5;

    rotQuiet[i * 3 + 0] = Math.random() * Math.PI * 2;
    rotQuiet[i * 3 + 1] = Math.random() * Math.PI * 2;
    rotQuiet[i * 3 + 2] = Math.random() * Math.PI * 2;

    // Matter Types: 50% Cream Parchment, 35% Archival Ink, 15% Gold Leaf
    shardTypes[i] = Math.random();

    // Scale variation for natural organic torn scrap feel
    const s = 0.16 + Math.random() * 0.16;
    shardScales[i * 2 + 0] = s * (0.85 + Math.random() * 0.3);
    shardScales[i * 2 + 1] = s * (0.85 + Math.random() * 0.3);

    randomAttrs[i * 4 + 0] = Math.random(); // Stagger delay
    randomAttrs[i * 4 + 1] = Math.random();
    randomAttrs[i * 4 + 2] = Math.random();
    randomAttrs[i * 4 + 3] = Math.random();
  }

  // 2. Target 0: Cyrillic headline «ПРИСТЕБНІТЬ РЕМЕНІ.» (Single focal point Center-Top)
  const text0Data = sampleTextForShards(['ПРИСТЕБНІТЬ', 'РЕМЕНІ.'], INSTANCE_COUNT, {
    x: 0,
    y: 0.95,
    z: 0.2,
    width: 6.8,
    height: 3.2
  });

  // 3. Target 1: Archival Childhood Craft Photograph (Grid of 500 physical tiles)
  const photo1Data = samplePhotoForShards(INSTANCE_COUNT, {
    x: 0,
    y: 0.75,
    z: 0.2,
    width: 5.2,
    height: 3.6
  }, 25, 20);

  // 4. Target 2: 3D Vintage Camera GLTF (300 shards) + Crimea Photo (200 shards)
  const CAMERA_COUNT = 300;
  const CRIMEA_COUNT = INSTANCE_COUNT - CAMERA_COUNT;

  const cameraData = await sampleGLTFForShards('/assets/models/vintage_camera.glb', CAMERA_COUNT, {
    x: -1.7,
    y: 0.55,
    z: 0.0,
    scale: 2.0
  });

  const crimeaData = samplePhotoForShards(CRIMEA_COUNT, {
    x: 1.7,
    y: 0.55,
    z: 0.2,
    width: 3.6,
    height: 2.6
  }, 20, 10);

  const posObject2 = new Float32Array(INSTANCE_COUNT * 3);
  const rotObject2 = new Float32Array(INSTANCE_COUNT * 3);
  const uvObject2 = new Float32Array(INSTANCE_COUNT * 2);

  for (let i = 0; i < CAMERA_COUNT; i++) {
    posObject2[i * 3 + 0] = cameraData.positions[i * 3 + 0];
    posObject2[i * 3 + 1] = cameraData.positions[i * 3 + 1];
    posObject2[i * 3 + 2] = cameraData.positions[i * 3 + 2];

    rotObject2[i * 3 + 0] = cameraData.rotations[i * 3 + 0];
    rotObject2[i * 3 + 1] = cameraData.rotations[i * 3 + 1];
    rotObject2[i * 3 + 2] = cameraData.rotations[i * 3 + 2];

    uvObject2[i * 2 + 0] = 0.5;
    uvObject2[i * 2 + 1] = 0.5;
  }
  for (let i = 0; i < CRIMEA_COUNT; i++) {
    const srcIdx3 = i * 3;
    const dstIdx3 = (CAMERA_COUNT + i) * 3;
    const srcIdx2 = i * 2;
    const dstIdx2 = (CAMERA_COUNT + i) * 2;

    posObject2[dstIdx3 + 0] = crimeaData.positions[srcIdx3 + 0];
    posObject2[dstIdx3 + 1] = crimeaData.positions[srcIdx3 + 1];
    posObject2[dstIdx3 + 2] = crimeaData.positions[srcIdx3 + 2];

    rotObject2[dstIdx3 + 0] = crimeaData.rotations[srcIdx3 + 0];
    rotObject2[dstIdx3 + 1] = crimeaData.rotations[srcIdx3 + 1];
    rotObject2[dstIdx3 + 2] = crimeaData.rotations[srcIdx3 + 2];

    uvObject2[dstIdx2 + 0] = crimeaData.uvs[srcIdx2 + 0];
    uvObject2[dstIdx2 + 1] = crimeaData.uvs[srcIdx2 + 1];
  }

  // --------------------------------------------------------------------------
  // Pack attributes into compact vec4 buffers to stay well within WebGL 16 attribute limit
  // --------------------------------------------------------------------------
  const attrPosRot0 = new Float32Array(INSTANCE_COUNT * 4);
  const attrRot0Scale = new Float32Array(INSTANCE_COUNT * 4);
  const attrTargetText0 = new Float32Array(INSTANCE_COUNT * 4);
  const attrTargetPhoto1 = new Float32Array(INSTANCE_COUNT * 4);
  const attrTargetObject2 = new Float32Array(INSTANCE_COUNT * 4);
  const attrMeta = new Float32Array(INSTANCE_COUNT * 4);
  const attrRandom = new Float32Array(INSTANCE_COUNT * 4);

  for (let i = 0; i < INSTANCE_COUNT; i++) {
    const i3 = i * 3;
    const i4 = i * 4;

    // Buffer 1: posQuiet.xyz + rotQuiet.x
    attrPosRot0[i4 + 0] = posQuiet[i3 + 0];
    attrPosRot0[i4 + 1] = posQuiet[i3 + 1];
    attrPosRot0[i4 + 2] = posQuiet[i3 + 2];
    attrPosRot0[i4 + 3] = rotQuiet[i3 + 0];

    // Buffer 2: rotQuiet.yz + shardScales.xy
    attrRot0Scale[i4 + 0] = rotQuiet[i3 + 1];
    attrRot0Scale[i4 + 1] = rotQuiet[i3 + 2];
    attrRot0Scale[i4 + 2] = shardScales[i * 2 + 0];
    attrRot0Scale[i4 + 3] = shardScales[i * 2 + 1];

    // Buffer 3: text0.xyz + shardTypes
    attrTargetText0[i4 + 0] = text0Data.positions[i3 + 0];
    attrTargetText0[i4 + 1] = text0Data.positions[i3 + 1];
    attrTargetText0[i4 + 2] = text0Data.positions[i3 + 2];
    attrTargetText0[i4 + 3] = shardTypes[i];

    // Buffer 4: photo1.xyz + uv1.x
    attrTargetPhoto1[i4 + 0] = photo1Data.positions[i3 + 0];
    attrTargetPhoto1[i4 + 1] = photo1Data.positions[i3 + 1];
    attrTargetPhoto1[i4 + 2] = photo1Data.positions[i3 + 2];
    attrTargetPhoto1[i4 + 3] = photo1Data.uvs[i * 2 + 0];

    // Buffer 5: object2.xyz + uv1.y
    attrTargetObject2[i4 + 0] = posObject2[i3 + 0];
    attrTargetObject2[i4 + 1] = posObject2[i3 + 1];
    attrTargetObject2[i4 + 2] = posObject2[i3 + 2];
    attrTargetObject2[i4 + 3] = photo1Data.uvs[i * 2 + 1];

    // Buffer 6: uv2.xy + extra
    attrMeta[i4 + 0] = uvObject2[i * 2 + 0];
    attrMeta[i4 + 1] = uvObject2[i * 2 + 1];
    attrMeta[i4 + 2] = 0.0;
    attrMeta[i4 + 3] = 0.0;

    // Buffer 7: random.xyzw
    attrRandom[i4 + 0] = randomAttrs[i4 + 0];
    attrRandom[i4 + 1] = randomAttrs[i4 + 1];
    attrRandom[i4 + 2] = randomAttrs[i4 + 2];
    attrRandom[i4 + 3] = randomAttrs[i4 + 3];
  }

  // Load Textures for Dynamic Shading
  const texLoader = new THREE.TextureLoader();
  const texPhoto1 = texLoader.load('/assets/textures/embroidery_threads.jpg');
  texPhoto1.colorSpace = THREE.SRGBColorSpace;

  const texCrimea = texLoader.load('/assets/textures/crimea_sea.jpg');
  texCrimea.colorSpace = THREE.SRGBColorSpace;

  // Set Instanced Attributes
  shardsGeometry.setAttribute('aPosRot0', new THREE.InstancedBufferAttribute(attrPosRot0, 4));
  shardsGeometry.setAttribute('aRot0Scale', new THREE.InstancedBufferAttribute(attrRot0Scale, 4));
  shardsGeometry.setAttribute('aTargetText0', new THREE.InstancedBufferAttribute(attrTargetText0, 4));
  shardsGeometry.setAttribute('aTargetPhoto1', new THREE.InstancedBufferAttribute(attrTargetPhoto1, 4));
  shardsGeometry.setAttribute('aTargetObject2', new THREE.InstancedBufferAttribute(attrTargetObject2, 4));
  shardsGeometry.setAttribute('aMeta', new THREE.InstancedBufferAttribute(attrMeta, 4));
  shardsGeometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(attrRandom, 4));

  // Custom GLSL Instanced Shard Material
  shardsMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uProgress;
      uniform float uVelocity;
      uniform float uTime;

      attribute vec4 aPosRot0;
      attribute vec4 aRot0Scale;
      attribute vec4 aTargetText0;
      attribute vec4 aTargetPhoto1;
      attribute vec4 aTargetObject2;
      attribute vec4 aMeta;
      attribute vec4 aRandom;

      varying vec2 vUV;
      varying vec2 vTileUV;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying float vShardType;
      varying float vStage;
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

      mat3 getEulerRot(vec3 rot) {
        float cx = cos(rot.x), sx = sin(rot.x);
        float cy = cos(rot.y), sy = sin(rot.y);
        float cz = cos(rot.z), sz = sin(rot.z);
        return mat3(
          cy*cz, -cy*sz, sy,
          cx*sz + sx*sy*cz, cx*cz - sx*sy*sz, -sx*cy,
          sx*sz - cx*sy*cz, sx*cz + cx*sy*sz, cx*cy
        );
      }

      void main() {
        vUV = uv;
        vShardType = aTargetText0.w;

        // Unpack attributes
        vec3 p0 = aPosRot0.xyz;
        vec3 r0 = vec3(aPosRot0.w, aRot0Scale.xy);
        vec2 shardScale = aRot0Scale.zw;

        vec3 p1 = aTargetText0.xyz;
        vec3 p2 = aTargetPhoto1.xyz;
        vec2 uv1 = vec2(aTargetPhoto1.w, aTargetObject2.w);

        vec3 p3 = aTargetObject2.xyz;
        vec2 uv2 = aMeta.xy;

        // Staggered wave delay per instance
        float stagger = aRandom.x * 0.12;
        float p = clamp((uProgress - stagger) / (1.0 - stagger), 0.0, 1.0);

        vec3 instPos;
        vec3 instRot;
        float morphArc = 0.0;
        float stageVal = 0.0;

        // Stage 0: Quiet Hovering -> Headline «ПРИСТЕБНІТЬ РЕМЕНІ.» (p in 0.00 -> 0.16)
        if (p <= 0.16) {
          float t = smoothstep(0.0, 0.12, p);
          instPos = mix(p0, p1, t);
          instRot = mix(r0, vec3(0.0), t);
          morphArc = sin(t * 3.14159265) * step(t, 0.98);
          stageVal = 0.0;
          vTileUV = vec2(0.5);
        }
        // Stage 1: Headline -> Archival Childhood Photo (p in 0.16 -> 0.50)
        else if (p <= 0.50) {
          float t = smoothstep(0.18, 0.44, p);
          instPos = mix(p1, p2, t);
          instRot = mix(vec3(0.0), vec3(0.0), t);
          morphArc = sin(t * 3.14159265) * step(t, 0.98);
          stageVal = mix(0.0, 1.0, smoothstep(0.3, 0.9, t));
          vTileUV = uv1;
        }
        // Stage 2: Photo -> 3D Camera + Crimea Sea (p in 0.50 -> 1.00)
        else {
          float t = smoothstep(0.55, 0.88, p);
          instPos = mix(p2, p3, t);
          instRot = mix(vec3(0.0), r0 * 0.5, t);
          morphArc = sin(t * 3.14159265) * step(t, 0.98);
          stageVal = mix(1.0, 2.0, smoothstep(0.3, 0.9, t));
          vTileUV = uv2;
        }

        vStage = stageVal;

        // Soft breathing pulsation when resting in place
        if (morphArc < 0.05 && abs(uVelocity) < 0.05) {
          instPos += vec3(sin(uTime * 1.5 + instPos.y) * 0.012, cos(uTime * 1.5 + instPos.x) * 0.012, 0.0);
        }

        // Curl turbulence active during fast motion & transition arcs
        float velTurbulence = clamp(abs(uVelocity) * 1.5, 0.0, 3.5);
        float totalTurbulence = morphArc * 1.4 + velTurbulence;
        
        vec3 noiseVec = curl(instPos * 0.4 + vec3(uTime * 0.2) + aRandom.xyz * 0.5);
        instPos += noiseVec * (totalTurbulence * 0.45);

        // 3D Rotational tumbling in flight
        instRot += noiseVec * (totalTurbulence * 0.8);
        mat3 rotMat = getEulerRot(instRot);

        // Apply physical local quad geometry, scale & rotation
        vec3 localPos = position * vec3(shardScale, 1.0);
        vec3 worldOffset = rotMat * localPos;
        vec3 finalWorldPos = instPos + worldOffset;

        vNormal = normalize(rotMat * normal);
        vWorldPos = finalWorldPos;
        vAlpha = 0.98;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalWorldPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexturePhoto;
      uniform sampler2D uTextureCrimea;

      varying vec2 vUV;
      varying vec2 vTileUV;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying float vShardType;
      varying float vStage;
      varying float vAlpha;

      void main() {
        // Shard Palette:
        // 50% Cream Parchment: #e8dcc0 (0.93, 0.88, 0.78)
        // 35% Blue-Black Ink:  #1a1f2e (0.14, 0.16, 0.24)
        // 15% Enchanted Gold:  #fce2b8 (1.00, 0.90, 0.74)
        vec3 baseParchmentColor;
        if (vShardType < 0.50) {
          baseParchmentColor = vec3(0.93, 0.88, 0.78);
        } else if (vShardType < 0.85) {
          baseParchmentColor = vec3(0.14, 0.16, 0.24);
        } else {
          baseParchmentColor = vec3(1.00, 0.90, 0.74);
        }

        // Double-sided lighting on physical paper scrap
        vec3 lightDir = normalize(vec3(0.4, 0.8, 1.0));
        float diff = max(0.35, abs(dot(vNormal, lightDir)));

        // Ragged gold edge contour (outer perimeter of the quad)
        vec2 edgeDist = abs(vUV - vec2(0.5)) * 2.0;
        float maxEdge = max(edgeDist.x, edgeDist.y);
        float rim = smoothstep(0.72, 0.98, maxEdge);
        vec3 goldRim = vec3(0.98, 0.88, 0.70);

        vec3 surfaceColor = baseParchmentColor;

        if (vStage > 0.0 && vStage <= 1.0) {
          vec4 texColor = texture2D(uTexturePhoto, vTileUV);
          surfaceColor = mix(baseParchmentColor, texColor.rgb * 1.25, vStage);
        } else if (vStage > 1.0) {
          float stage2Factor = clamp(vStage - 1.0, 0.0, 1.0);
          vec4 texColor = texture2D(uTextureCrimea, vTileUV);
          vec3 cameraTone = vec3(0.94, 0.85, 0.68);
          vec3 targetObjColor = mix(cameraTone, texColor.rgb * 1.25, step(0.0, vWorldPos.x));
          surfaceColor = mix(baseParchmentColor, targetObjColor, stage2Factor);
        }

        vec3 finalColor = mix(surfaceColor * diff, goldRim, rim * 0.42);
        gl_FragColor = vec4(finalColor, vAlpha);
      }
    `,
    uniforms: {
      uProgress: { value: 0.0 },
      uVelocity: { value: 0.0 },
      uTime: { value: 0.0 },
      uTexturePhoto: { value: texPhoto1 },
      uTextureCrimea: { value: texCrimea }
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true
  });

  shardsMesh = new THREE.InstancedMesh(shardsGeometry, shardsMaterial, INSTANCE_COUNT);
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
