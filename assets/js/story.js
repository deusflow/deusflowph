/**
 * DEUSFLOW · NIGHT IN THE HOGWARTS LIBRARY
 * Clean Transition-Only Shard Engine (Architecture Refactor)
 * 
 * Rules:
 * - Shards exist ONLY during section transitions (IDLE -> SPAWN -> FLIGHT -> FADEOUT)
 * - Zero shards in static reading states
 * - Forms and imagery live entirely in semantic DOM with CSS clip-path reveals
 */

import * as THREE from 'three';

const SHARD_COUNT = 450;
const DUST_COUNT = 70;

let scene, camera, renderer;
let clock = new THREE.Clock();

let shardsMesh, shardsMaterial, shardsGeometry;
let dustMesh, dustMaterial, dustGeometry;

let mouseX = 0, mouseY = 0;

// Shard State Arrays (Managed on CPU for physics, rendered via InstancedBufferGeometry)
const instPos = new Float32Array(SHARD_COUNT * 3);
const instVel = new Float32Array(SHARD_COUNT * 3);
const instRot = new Float32Array(SHARD_COUNT * 3);
const instRotSpeed = new Float32Array(SHARD_COUNT * 3);
const instScale = new Float32Array(SHARD_COUNT * 2);
const instLife = new Float32Array(SHARD_COUNT); // 0 = idle, >0 in flight
const instMaxLife = new Float32Array(SHARD_COUNT);
const instStagger = new Float32Array(SHARD_COUNT);
const instType = new Float32Array(SHARD_COUNT); // 0=parchment, 1=ink, 2=gold

// Packed Instanced Attributes for WebGL
let attrInstancePos, attrInstanceRot, attrInstanceScale, attrInstanceMeta;

// ==========================================================================
// 1. THREE.JS INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (document.fonts) {
    await document.fonts.ready;
  }
  initThree();
  buildDustMotes();
  buildInstancedShards();
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
// 2. DUST MOTES IN WINDOW LIGHT BEAM (EMBER/DUST SYSTEM)
// ==========================================================================
// EMBER/DUST SYSTEM - Ambient Context
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
// 3. PURE INSTANCED MESH TORN PARCHMENT SHARD SYSTEM
// ==========================================================================
function buildInstancedShards() {
  const baseGeom = new THREE.BufferGeometry();
  
  // Ragged quadrilateral with displaced vertices
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

  // Initialize all shards in IDLE state (scale = 0, alpha = 0)
  for (let i = 0; i < SHARD_COUNT; i++) {
    instPos[i * 3 + 0] = 0;
    instPos[i * 3 + 1] = -100; // Far offscreen
    instPos[i * 3 + 2] = 0;

    instRot[i * 3 + 0] = 0;
    instRot[i * 3 + 1] = 0;
    instRot[i * 3 + 2] = 0;

    instScale[i * 2 + 0] = 0.0; // Invisible in IDLE
    instScale[i * 2 + 1] = 0.0;

    instLife[i] = 0.0;
    instMaxLife[i] = 1.5;
    instStagger[i] = 0.0;

    const r = Math.random();
    instType[i] = r < 0.50 ? 0.0 : (r < 0.85 ? 1.0 : 2.0);
  }

  const attrPosData = new Float32Array(SHARD_COUNT * 4); // pos.xyz + alpha
  const attrRotData = new Float32Array(SHARD_COUNT * 4); // rot.xyz + unused
  const attrScaleData = new Float32Array(SHARD_COUNT * 4); // scale.xy + type + progress

  for (let i = 0; i < SHARD_COUNT; i++) {
    attrPosData[i * 4 + 0] = instPos[i * 3 + 0];
    attrPosData[i * 4 + 1] = instPos[i * 3 + 1];
    attrPosData[i * 4 + 2] = instPos[i * 3 + 2];
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

  // Material with Double-Sided Paper Lighting and Ragged Gold Edge Foil
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
// 4. ANIMATION LOOP
// ==========================================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  if (dustMaterial) {
    dustMaterial.uniforms.uTime.value = time;
  }

  // Update shard positions on CPU for active transitions
  updateShards(delta, time);

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
      instLife[i] -= delta;
      const progress = 1.0 - (instLife[i] / instMaxLife[i]); // 0 -> 1

      if (progress >= 1.0 || instLife[i] <= 0) {
        // Return to IDLE
        instLife[i] = 0;
        posArr[i * 4 + 3] = 0.0; // Alpha 0
        scaleArr[i * 4 + 0] = 0.0;
        scaleArr[i * 4 + 1] = 0.0;
        continue;
      }

      // Physics: Vortex down and outward
      instPos[i * 3 + 0] += instVel[i * 3 + 0] * delta;
      instPos[i * 3 + 1] += instVel[i * 3 + 1] * delta;
      instPos[i * 3 + 2] += instVel[i * 3 + 2] * delta;

      // Gravity downward
      instVel[i * 3 + 1] -= 2.5 * delta;

      // Rotation
      instRot[i * 3 + 0] += instRotSpeed[i * 3 + 0] * delta;
      instRot[i * 3 + 1] += instRotSpeed[i * 3 + 1] * delta;
      instRot[i * 3 + 2] += instRotSpeed[i * 3 + 2] * delta;

      // Fadeout in last 20%
      let alpha = 0.95;
      let curScale = 1.0;
      if (progress > 0.8) {
        const fade = (1.0 - progress) / 0.2;
        alpha = fade * 0.95;
        curScale = 0.85 + 0.15 * fade;
      }

      posArr[i * 4 + 0] = instPos[i * 3 + 0];
      posArr[i * 4 + 1] = instPos[i * 3 + 1];
      posArr[i * 4 + 2] = instPos[i * 3 + 2];
      posArr[i * 4 + 3] = alpha;

      rotArr[i * 4 + 0] = instRot[i * 3 + 0];
      rotArr[i * 4 + 1] = instRot[i * 3 + 1];
      rotArr[i * 4 + 2] = instRot[i * 3 + 2];

      scaleArr[i * 4 + 0] = instScale[i * 2 + 0] * curScale;
      scaleArr[i * 4 + 1] = instScale[i * 2 + 1] * curScale;
      scaleArr[i * 4 + 3] = progress;
    }
  }

  if (hasActiveShards) {
    attrInstancePos.needsUpdate = true;
    attrInstanceRot.needsUpdate = true;
    attrInstanceScale.needsUpdate = true;
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
