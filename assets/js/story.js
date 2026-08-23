/**
 * DEUSFLOW · NIGHT IN THE HOGWARTS LIBRARY
 * Transition-Only Shard Engine with State Machine (IDLE -> SPAWN -> FLIGHT -> FADEOUT)
 * 
 * Rules:
 * - Shards exist ONLY during section transitions [1->2], [2->3], [3->4]
 * - In static reading states: ALL shards are IDLE (scale 0, alpha 0, completely invisible)
 * - Transitions [0->1] and [4->5] are silent clip-path reveals (zero shards)
 * - Embers for Section [1] and Dust Motes in window beam are separate systems
 */

import * as THREE from 'three';

const SHARD_COUNT = 450;
const DUST_COUNT = 70;
const EMBER_COUNT = 20;

let scene, camera, renderer;
let clock = new THREE.Clock();

let shardsMesh, shardsMaterial, shardsGeometry;
let dustMesh, dustMaterial, dustGeometry;
let emberMesh, emberMaterial, emberGeometry;

let mouseX = 0, mouseY = 0;
let scrollVelocity = 0.0;
let lastScrollY = 0;
let currentActiveSection = 0;

// Shard Physics & State Machine Arrays (CPU Simulation -> GPU Instanced Rendering)
const instPos = new Float32Array(SHARD_COUNT * 3);
const instVel = new Float32Array(SHARD_COUNT * 3);
const instRot = new Float32Array(SHARD_COUNT * 3);
const instRotSpeed = new Float32Array(SHARD_COUNT * 3);
const instScale = new Float32Array(SHARD_COUNT * 2);
const instLife = new Float32Array(SHARD_COUNT);       // 0 = IDLE, >0 = FLIGHT
const instMaxLife = new Float32Array(SHARD_COUNT);
const instStagger = new Float32Array(SHARD_COUNT);
const instType = new Float32Array(SHARD_COUNT);       // 0=parchment, 1=ink, 2=gold

// Packed Instanced Attributes for WebGL
let attrInstancePos, attrInstanceRot, attrInstanceScale;

// HUD Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');
const audioToggle = document.getElementById('audio-toggle');
const audioStatus = document.getElementById('audio-status');

const sectionMeta = [
  { title: 'PROLOGUE // THE THRESHOLD', timecode: 'FOLIO 01 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'FOLIO 01 // THE INITIATION', timecode: 'FOLIO 02 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '01 // CRAFT & EMBROIDERY', timecode: 'FOLIO 03 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '02 // THE FIRST LENS · 35MM', timecode: 'FOLIO 04 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '03 // CANON 1000D · DIGITAL', timecode: 'FOLIO 05 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'EPILOGUE // THE STILLNESS', timecode: 'FOLIO 06 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' }
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
  buildTitleEmbers();
  buildInstancedShards();
  initScrollTriggerNavigation();
  initMouseListener();
  initAudio();
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

  window.triggerShardTransition = triggerShardTransition;
  window.addEventListener('resize', onWindowResize);
}

// ==========================================================================
// 2. DUST MOTES IN WINDOW LIGHT BEAM (EMBER/DUST SYSTEM)
// ==========================================================================
// EMBER/DUST SYSTEM
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
        gl_PointSize = (16.0 / -mvPosition.z); // EMBER/DUST SYSTEM
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)); // EMBER/DUST SYSTEM
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

  dustMesh = new THREE.Points(dustGeometry, dustMaterial); // EMBER/DUST SYSTEM
  scene.add(dustMesh);
}

// ==========================================================================
// 3. TITLE SECTION [1] EMBER DRIFT SYSTEM (EMBER/DUST SYSTEM)
// ==========================================================================
// EMBER/DUST SYSTEM - Title Section Drift Embers (15-20 particles)
function buildTitleEmbers() {
  emberGeometry = new THREE.BufferGeometry();
  const emberPos = new Float32Array(EMBER_COUNT * 3);

  for (let i = 0; i < EMBER_COUNT; i++) {
    emberPos[i * 3 + 0] = (Math.random() - 0.5) * 4.5;
    emberPos[i * 3 + 1] = (Math.random() - 0.5) * 3.0;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
  }

  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));

  emberMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uTime;
      uniform float uVisibility;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.6 + position.y * 3.0) * 0.25;
        p.y += cos(uTime * 0.5 + position.x * 3.0) * 0.20;
        p.z += sin(uTime * 0.4 + position.z * 3.0) * 0.15;

        vAlpha = uVisibility * (0.45 + 0.35 * sin(uTime * 1.2 + position.x * 5.0));

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (22.0 / -mvPosition.z); // EMBER/DUST SYSTEM
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)); // EMBER/DUST SYSTEM
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.45, d);
        vec3 goldColor = vec3(1.00, 0.88, 0.65);
        gl_FragColor = vec4(goldColor, core * vAlpha * 0.75);
      }
    `,
    uniforms: {
      uTime: { value: 0.0 },
      uVisibility: { value: 0.0 } // 1.0 only in section 1
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  emberMesh = new THREE.Points(emberGeometry, emberMaterial); // EMBER/DUST SYSTEM
  scene.add(emberMesh);
}

// ==========================================================================
// 4. TRANSITION-ONLY SHARD ENGINE (THREE.InstancedMesh, 450 instances)
// ==========================================================================
function buildInstancedShards() {
  const baseGeom = new THREE.BufferGeometry();
  
  // Ragged polygonal quadrilateral with displaced vertices
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

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3
  ]);

  baseGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  baseGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  baseGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  baseGeom.setIndex(new THREE.BufferAttribute(indices, 1));

  shardsGeometry = new THREE.InstancedBufferGeometry();
  shardsGeometry.index = baseGeom.index;
  shardsGeometry.attributes.position = baseGeom.attributes.position;
  shardsGeometry.attributes.normal = baseGeom.attributes.normal;
  shardsGeometry.attributes.uv = baseGeom.attributes.uv;

  // Initialize ALL shards into IDLE state (scale = 0, alpha = 0, offscreen)
  const attrPosData = new Float32Array(SHARD_COUNT * 4);   // pos.xyz + alpha
  const attrRotData = new Float32Array(SHARD_COUNT * 4);   // rot.xyz + unused
  const attrScaleData = new Float32Array(SHARD_COUNT * 4); // scale.xy + type + progress

  for (let i = 0; i < SHARD_COUNT; i++) {
    instPos[i * 3 + 0] = 0;
    instPos[i * 3 + 1] = -100.0; // Far offscreen
    instPos[i * 3 + 2] = 0;

    instRot[i * 3 + 0] = 0;
    instRot[i * 3 + 1] = 0;
    instRot[i * 3 + 2] = 0;

    instScale[i * 2 + 0] = 0.0; // INVISIBLE IN IDLE
    instScale[i * 2 + 1] = 0.0;

    instLife[i] = 0.0; // IDLE
    instMaxLife[i] = 1.5;
    instStagger[i] = 0.0;

    const r = Math.random();
    instType[i] = r < 0.50 ? 0.0 : (r < 0.85 ? 1.0 : 2.0); // 50% parchment, 35% ink, 15% gold

    attrPosData[i * 4 + 0] = 0;
    attrPosData[i * 4 + 1] = -100.0;
    attrPosData[i * 4 + 2] = 0;
    attrPosData[i * 4 + 3] = 0.0; // Alpha 0

    attrRotData[i * 4 + 0] = 0;
    attrRotData[i * 4 + 1] = 0;
    attrRotData[i * 4 + 2] = 0;
    attrRotData[i * 4 + 3] = 0;

    attrScaleData[i * 4 + 0] = 0.0;
    attrScaleData[i * 4 + 1] = 0.0;
    attrScaleData[i * 4 + 2] = instType[i];
    attrScaleData[i * 4 + 3] = 0.0;
  }

  attrInstancePos = new THREE.InstancedBufferAttribute(attrPosData, 4);
  attrInstancePos.setUsage(THREE.DynamicDrawUsage);

  attrInstanceRot = new THREE.InstancedBufferAttribute(attrRotData, 4);
  attrInstanceRot.setUsage(THREE.DynamicDrawUsage);

  attrInstanceScale = new THREE.InstancedBufferAttribute(attrScaleData, 4);
  attrInstanceScale.setUsage(THREE.DynamicDrawUsage);

  shardsGeometry.setAttribute('aInstancePos', attrInstancePos);
  shardsGeometry.setAttribute('aInstanceRot', attrInstanceRot);
  shardsGeometry.setAttribute('aInstanceScale', attrInstanceScale);

  // Instanced Material with Double-Sided Paper Lighting and Ragged Gold Edge Foil
  shardsMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      attribute vec4 aInstancePos;   // pos.xyz + alpha
      attribute vec4 aInstanceRot;   // rot.xyz
      attribute vec4 aInstanceScale; // scale.xy + type + lifeProgress

      varying vec2 vUV;
      varying vec3 vNormal;
      varying float vShardType;
      varying float vAlpha;

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
        vShardType = aInstanceScale.z;
        vAlpha = aInstancePos.w;

        vec3 instPos = aInstancePos.xyz;
        vec3 instRot = aInstanceRot.xyz;
        vec2 shardScale = aInstanceScale.xy;

        mat3 rotMat = getEulerRot(instRot);
        vec3 localPos = position * vec3(shardScale, 1.0);
        vec3 worldOffset = rotMat * localPos;
        vec3 finalWorldPos = instPos + worldOffset;

        vNormal = normalize(rotMat * normal);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalWorldPos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUV;
      varying vec3 vNormal;
      varying float vShardType;
      varying float vAlpha;

      void main() {
        if (vAlpha <= 0.001) discard;

        // Palette:
        // 0.0 = Cream Parchment: #e8dcc0 (0.93, 0.88, 0.78)
        // 1.0 = Archival Ink:    #1a1f2e (0.14, 0.16, 0.24)
        // 2.0 = Gold Leaf:       #fce2b8 (1.00, 0.90, 0.74)
        vec3 baseColor;
        if (vShardType < 0.5) {
          baseColor = vec3(0.93, 0.88, 0.78);
        } else if (vShardType < 1.5) {
          baseColor = vec3(0.14, 0.16, 0.24);
        } else {
          baseColor = vec3(1.00, 0.90, 0.74);
        }

        // Double-Sided Paper Lighting
        vec3 lightDir = normalize(vec3(0.4, 0.8, 1.0));
        float diff = max(0.35, abs(dot(vNormal, lightDir)));

        // Ragged Gold Foil Edge Contour
        vec2 edgeDist = abs(vUV - vec2(0.5)) * 2.0;
        float maxEdge = max(edgeDist.x, edgeDist.y);
        float rim = smoothstep(0.70, 0.98, maxEdge);
        vec3 goldRim = vec3(0.98, 0.88, 0.70);

        vec3 finalColor = mix(baseColor * diff, goldRim, rim * 0.45);
        gl_FragColor = vec4(finalColor, vAlpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false
  });

  shardsMesh = new THREE.InstancedMesh(shardsGeometry, shardsMaterial, SHARD_COUNT);
  scene.add(shardsMesh);
}

// ==========================================================================
// 5. SHARD TRANSITION LIFECYCLE CONTROLLER (SPAWN -> FLIGHT -> FADEOUT)
// ==========================================================================

// Triggered ONLY on section transitions [1->2], [2->3], [3->4]
export function triggerShardTransition(fromSectionIdx, toSectionIdx, fromElement) {
  if (!fromElement || !attrInstancePos) return;

  const rect = fromElement.getBoundingClientRect();
  const screenW = window.innerWidth || 1440;
  const screenH = window.innerHeight || 900;

  // Convert 2D pixel bounding rectangle to 3D world space on focus plane (z = 0)
  const leftNdc = (rect.left / screenW) * 2 - 1;
  const rightNdc = (rect.right / screenW) * 2 - 1;
  const topNdc = -(rect.top / screenH) * 2 + 1;
  const bottomNdc = -(rect.bottom / screenH) * 2 + 1;

  // Perspective unproject factor for camera at z = 8.0 with fov = 45
  const aspect = camera.aspect;
  const vFov = (camera.fov * Math.PI) / 180;
  const planeHeight = 2.0 * Math.tan(vFov / 2.0) * camera.position.z;
  const planeWidth = planeHeight * aspect;

  const minX = leftNdc * (planeWidth / 2);
  const maxX = rightNdc * (planeWidth / 2);
  const maxY = topNdc * (planeHeight / 2);
  const minY = bottomNdc * (planeHeight / 2);

  const centerWorldX = (minX + maxX) / 2;
  const centerWorldY = (minY + maxY) / 2;

  const velMultiplier = Math.min(2.5, 1.0 + Math.abs(scrollVelocity) * 0.8);

  const posArr = attrInstancePos.array;
  const rotArr = attrInstanceRot.array;
  const scaleArr = attrInstanceScale.array;

  for (let i = 0; i < SHARD_COUNT; i++) {
    // 1. SPAWN: Sample perimeter of the outgoing form
    const side = Math.floor(Math.random() * 4);
    let sx, sy;
    if (side === 0) { // Top edge
      sx = minX + Math.random() * (maxX - minX);
      sy = maxY + (Math.random() - 0.5) * 0.2;
    } else if (side === 1) { // Bottom edge
      sx = minX + Math.random() * (maxX - minX);
      sy = minY + (Math.random() - 0.5) * 0.2;
    } else if (side === 2) { // Left edge
      sx = minX + (Math.random() - 0.5) * 0.2;
      sy = minY + Math.random() * (maxY - minY);
    } else { // Right edge
      sx = maxX + (Math.random() - 0.5) * 0.2;
      sy = minY + Math.random() * (maxY - minY);
    }

    instPos[i * 3 + 0] = sx;
    instPos[i * 3 + 1] = sy;
    instPos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;

    // 2. FLIGHT: Outward spiral vector + Downward gravity
    const outDirX = (sx - centerWorldX) || (Math.random() - 0.5);
    const speed = (2.4 + Math.random() * 3.2) * velMultiplier;

    instVel[i * 3 + 0] = outDirX * speed * 0.75 + (Math.random() - 0.5) * 1.8;
    instVel[i * 3 + 1] = -Math.abs(speed * 1.3) - Math.random() * 1.6; // Downward
    instVel[i * 3 + 2] = (Math.random() - 0.5) * 2.2;

    // Random 3-axis Euler tumble rotation
    instRot[i * 3 + 0] = Math.random() * Math.PI * 2;
    instRot[i * 3 + 1] = Math.random() * Math.PI * 2;
    instRot[i * 3 + 2] = Math.random() * Math.PI * 2;

    instRotSpeed[i * 3 + 0] = (Math.random() - 0.5) * 9.0 * velMultiplier;
    instRotSpeed[i * 3 + 1] = (Math.random() - 0.5) * 9.0 * velMultiplier;
    instRotSpeed[i * 3 + 2] = (Math.random() - 0.5) * 9.0 * velMultiplier;

    // Stagger delay: larger shards launch first (0 to 0.12s)
    const isLarge = Math.random() < 0.35;
    const baseScale = isLarge ? (0.28 + Math.random() * 0.15) : (0.15 + Math.random() * 0.12);
    instScale[i * 2 + 0] = baseScale * (0.85 + Math.random() * 0.3);
    instScale[i * 2 + 1] = baseScale * (0.85 + Math.random() * 0.3);

    instStagger[i] = isLarge ? Math.random() * 0.04 : (0.03 + Math.random() * 0.10);
    instMaxLife[i] = (1.5 + Math.random() * 0.6) / velMultiplier;
    instLife[i] = instMaxLife[i];

    // Populate initial attributes immediately
    posArr[i * 4 + 0] = sx;
    posArr[i * 4 + 1] = sy;
    posArr[i * 4 + 2] = instPos[i * 3 + 2];
    posArr[i * 4 + 3] = 0.96; // Alpha

    rotArr[i * 4 + 0] = instRot[i * 3 + 0];
    rotArr[i * 4 + 1] = instRot[i * 3 + 1];
    rotArr[i * 4 + 2] = instRot[i * 3 + 2];

    scaleArr[i * 4 + 0] = instScale[i * 2 + 0];
    scaleArr[i * 4 + 1] = instScale[i * 2 + 1];
    scaleArr[i * 4 + 2] = instType[i];
    scaleArr[i * 4 + 3] = 0.0;
  }

  attrInstancePos.needsUpdate = true;
  attrInstanceRot.needsUpdate = true;
  attrInstanceScale.needsUpdate = true;
}

// ==========================================================================
// 6. ANIMATION & CPU PHYSICS LOOP
// ==========================================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  if (dustMaterial) {
    dustMaterial.uniforms.uTime.value = time;
  }

  if (emberMaterial) {
    emberMaterial.uniforms.uTime.value = time;
    // Embers visible only in Section [1]
    const targetEmberVis = currentActiveSection === 1 ? 1.0 : 0.0;
    emberMaterial.uniforms.uVisibility.value += (targetEmberVis - emberMaterial.uniforms.uVisibility.value) * 0.08;
  }

  // Update shard state machine
  updateShards(delta, time);

  // Parallax camera tracking
  camera.position.x += (mouseX * 0.25 - camera.position.x) * 0.05;
  camera.position.y += (-mouseY * 0.20 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

function updateShards(delta, time) {
  if (!attrInstancePos) return;

  const posArr = attrInstancePos.array;
  const rotArr = attrInstanceRot.array;
  const scaleArr = attrInstanceScale.array;

  let hasActiveShards = false;

  for (let i = 0; i < SHARD_COUNT; i++) {
    if (instLife[i] > 0) {
      hasActiveShards = true;

      // Handle Stagger delay
      if (instStagger[i] > 0) {
        instStagger[i] -= delta;
        continue;
      }

      instLife[i] -= delta;
      const progress = clamp(1.0 - (instLife[i] / instMaxLife[i]), 0.0, 1.0);

      // FADEOUT / COMPLETE -> Return to IDLE
      if (progress >= 1.0 || instLife[i] <= 0) {
        instLife[i] = 0;
        posArr[i * 4 + 0] = 0;
        posArr[i * 4 + 1] = -100.0; // Offscreen
        posArr[i * 4 + 2] = 0;
        posArr[i * 4 + 3] = 0.0;    // Alpha 0
        scaleArr[i * 4 + 0] = 0.0;  // Scale 0
        scaleArr[i * 4 + 1] = 0.0;
        continue;
      }

      // FLIGHT Physics: Velocity + Gravity + Curl Turbulence Kick
      const curlAmp = Math.sin(progress * Math.PI) * 2.8;
      const curlX = Math.sin(time * 2.5 + instPos[i * 3 + 1] * 0.9) * curlAmp;
      const curlZ = Math.cos(time * 2.5 + instPos[i * 3 + 0] * 0.9) * curlAmp;

      instPos[i * 3 + 0] += (instVel[i * 3 + 0] + curlX) * delta;
      instPos[i * 3 + 1] += instVel[i * 3 + 1] * delta;
      instPos[i * 3 + 2] += (instVel[i * 3 + 2] + curlZ) * delta;

      // Downward gravity acceleration
      instVel[i * 3 + 1] -= 4.5 * delta;

      // Rotational Tumbling
      instRot[i * 3 + 0] += instRotSpeed[i * 3 + 0] * delta;
      instRot[i * 3 + 1] += instRotSpeed[i * 3 + 1] * delta;
      instRot[i * 3 + 2] += instRotSpeed[i * 3 + 2] * delta;

      // Fadeout in last 20%
      let alpha = 0.96;
      let scaleMult = 1.0;
      if (progress > 0.80) {
        const fade = (1.0 - progress) / 0.20;
        alpha = fade * 0.96;
        scaleMult = 0.85 + 0.15 * fade;
      }

      posArr[i * 4 + 0] = instPos[i * 3 + 0];
      posArr[i * 4 + 1] = instPos[i * 3 + 1];
      posArr[i * 4 + 2] = instPos[i * 3 + 2];
      posArr[i * 4 + 3] = alpha;

      rotArr[i * 4 + 0] = instRot[i * 3 + 0];
      rotArr[i * 4 + 1] = instRot[i * 3 + 1];
      rotArr[i * 4 + 2] = instRot[i * 3 + 2];

      scaleArr[i * 4 + 0] = instScale[i * 2 + 0] * scaleMult;
      scaleArr[i * 4 + 1] = instScale[i * 2 + 1] * scaleMult;
      scaleArr[i * 4 + 3] = progress;
    }
  }

  if (hasActiveShards) {
    attrInstancePos.needsUpdate = true;
    attrInstanceRot.needsUpdate = true;
    attrInstanceScale.needsUpdate = true;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ==========================================================================
// 7. SCROLLTRIGGER NAVIGATION & CLIP-PATH ORCHESTRATION
// ==========================================================================
function initScrollTriggerNavigation() {
  const sections = document.querySelectorAll('.story-section');

  // GSAP ScrollTrigger per section
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    sections.forEach((sec, idx) => {
      const box = sec.querySelector('.section-content-box');

      ScrollTrigger.create({
        trigger: sec,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => {
          onSectionActivate(idx, 'down');
        },
        onEnterBack: () => {
          onSectionActivate(idx, 'up');
        },
        onLeave: () => {
          onSectionLeave(idx, 'down');
        },
        onLeaveBack: () => {
          onSectionLeave(idx, 'up');
        }
      });
    });
  }

  // Velocity calculation via wheel and touch
  window.addEventListener('wheel', (e) => {
    scrollVelocity = e.deltaY * 0.05;
  }, { passive: true });

  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    const diff = touchStartY - e.touches[0].clientY;
    touchStartY = e.touches[0].clientY;
    scrollVelocity = diff * 0.08;
  }, { passive: true });

  stepDots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      const step = parseInt(e.currentTarget.getAttribute('data-step'), 10);
      const targetSec = document.getElementById(`section-${step}`);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Reveal Section 0 on initial load
  const initialBox = document.getElementById('box-0');
  if (initialBox) {
    setTimeout(() => {
      initialBox.classList.add('revealing');
    }, 200);
  }
}

function onSectionActivate(newIdx, direction) {
  currentActiveSection = newIdx;

  // Reveal new section with clip-path
  const newBox = document.getElementById(`box-${newIdx}`);
  if (newBox) {
    newBox.classList.remove('dissolving');
    setTimeout(() => {
      newBox.classList.add('revealing');
    }, 150);
  }

  // Update Stepper & HUD
  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === newIdx);
  });

  const meta = sectionMeta[newIdx] || sectionMeta[0];
  if (hudSceneTitle) hudSceneTitle.textContent = meta.title;
  if (hudTimecode) hudTimecode.textContent = meta.timecode;
  if (hudActLabel) hudActLabel.textContent = meta.act;
}

function onSectionLeave(oldIdx, direction) {
  const oldBox = document.getElementById(`box-${oldIdx}`);
  if (oldBox) {
    oldBox.classList.remove('revealing');
    oldBox.classList.add('dissolving');
  }

  // Trigger Shards ONLY on transitions [1->2], [2->3], [3->4]
  if (direction === 'down' && (oldIdx === 1 || oldIdx === 2 || oldIdx === 3)) {
    // Expose triggerShardTransition globally for ScrollTrigger and test runners
    if (typeof window !== 'undefined') {
      window.triggerShardTransition = triggerShardTransition;
    }
    triggerShardTransition(oldIdx, oldIdx + 1, oldBox);
  } else if (direction === 'up' && (oldIdx === 2 || oldIdx === 3 || oldIdx === 4)) {
    triggerShardTransition(oldIdx, oldIdx - 1, oldBox);
  }
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
