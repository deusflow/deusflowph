/**
 * assets/js/story/vfx/altarMist.js
 * 
 * Ethereal Luminous Blue Altar Mist & Volumetric Billboard Puffs
 * Designed for DeusFlow 3D Cinematic Story.
 * Fully compliant with AGENTS.md:
 * - Solves "black sticks / ribs" issue:
 *   1. Zero rigid intersecting planes. Volumetric puffs are camera-facing billboards (quaternion.copy(camera.quaternion))
 *   2. Ultra-smooth Gaussian falloff exp(-dist * dist * 3.2) - ZERO sharp polygon lines or seams
 *   3. THREE.AdditiveBlending with soft celestial blue/cyan tones (ZERO black soot or dirty smudges)
 * - Ground Creeping Mist: horizontal soft luminous pool resting at the altar base
 * - Volumetric Soft Puffs: gentle drifting glowing blue clouds floating around the altar seams
 * - Strict Prohibition: Zero gl_PointSize / gl_PointCoord (physical 3D quads only)
 * - Depth-Write Integrity: depthWrite = false, renderOrder = 2, DoubleSide
 * - The One-Effect Rule: Subordinate, tranquil ambient glow supporting the central Goblet of Fire at fog2
 */
import * as THREE from 'three';
import { ALTAR_MIST_CONFIG, rawAltarMistConfig, registerAltarMistConfigListener } from '../storyConfig.js';

let fog1RootGroup = null;
let fire001RootGroup = null;
let groundMeshes = [];
let puffBillboards = [];
let groundMaterial = null;
let puffMaterial = null;

const altarMistUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: ALTAR_MIST_CONFIG.opacity },
  uFlowSpeed: { value: ALTAR_MIST_CONFIG.flowSpeed },
  uPuffDensity: { value: ALTAR_MIST_CONFIG.puffDensity },
  uGroundColor: { value: ALTAR_MIST_CONFIG.groundColor },
  uPuffColor: { value: ALTAR_MIST_CONFIG.puffColor },
  uRimColor: { value: ALTAR_MIST_CONFIG.rimColor }
};

// Common GLSL 2D Simplex Noise for organic fluid drift
const simplexNoiseGLSL = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/**
 * Live configuration applicator: called whenever ALTAR_MIST_CONFIG is changed in console or code.
 */
export function applyAltarMistConfig(prop, val) {
  if (prop === 'opacity') {
    const num = Number(val);
    rawAltarMistConfig.opacity = num;
    altarMistUniforms.uOpacity.value = num;
  } else if (prop === 'puffDensity') {
    const num = Number(val);
    rawAltarMistConfig.puffDensity = num;
    altarMistUniforms.uPuffDensity.value = num;
  } else if (prop === 'flowSpeed') {
    const num = Number(val);
    rawAltarMistConfig.flowSpeed = num;
    altarMistUniforms.uFlowSpeed.value = num;
  } else if (prop === 'groundRadius') {
    const r = Number(val);
    rawAltarMistConfig.groundRadius = r;
    groundMeshes.forEach((item) => {
      const mult = item.baseMultiplier || 1.0;
      item.mesh.scale.set(r * mult, r * mult, 1.0);
    });
  } else if (prop === 'puffRadius' || prop === 'puffHeight') {
    const r = Number(rawAltarMistConfig.puffRadius);
    const h = Number(rawAltarMistConfig.puffHeight);
    puffBillboards.forEach((item) => {
      const mult = item.baseMultiplier || 1.0;
      item.mesh.scale.set(r * mult, h * mult, 1.0);
    });
  } else if (prop === 'scale') {
    if (Array.isArray(val)) {
      rawAltarMistConfig.scale = val;
      if (fog1RootGroup) fog1RootGroup.scale.set(val[0], val[1], val[2]);
      if (fire001RootGroup) fire001RootGroup.scale.set(val[0], val[1], val[2]);
    } else if (typeof val === 'number') {
      rawAltarMistConfig.scale = [val, val, val];
      if (fog1RootGroup) fog1RootGroup.scale.set(val, val, val);
      if (fire001RootGroup) fire001RootGroup.scale.set(val, val, val);
    }
  } else if (prop === 'offsetFog1' && fog1RootGroup) {
    if (Array.isArray(val)) {
      rawAltarMistConfig.offsetFog1 = val;
      fog1RootGroup.position.set(val[0], val[1], val[2]);
    }
  } else if (prop === 'offsetFire001' && fire001RootGroup) {
    if (Array.isArray(val)) {
      rawAltarMistConfig.offsetFire001 = val;
      fire001RootGroup.position.set(val[0], val[1], val[2]);
    }
  } else if (prop === 'groundColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uGroundColor.value.copy(val);
    else altarMistUniforms.uGroundColor.value.set(val);
  } else if (prop === 'puffColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uPuffColor.value.copy(val);
    else altarMistUniforms.uPuffColor.value.set(val);
  } else if (prop === 'rimColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uRimColor.value.copy(val);
    else altarMistUniforms.uRimColor.value.set(val);
  }
}

// Register dynamic configuration listener
registerAltarMistConfigListener(applyAltarMistConfig);

/**
 * Creates Ground Creeping Mist layer (Option 1).
 * Smooth horizontal Gaussian luminous pool resting right on the base stone.
 */
function createGroundMistLayer(radius, yOffset, rotationZ, baseMultiplier, rotSpeed) {
  const geom = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
  const mesh = new THREE.Mesh(geom, groundMaterial);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.rotation.z = rotationZ;
  mesh.position.y = yOffset;
  mesh.scale.set(radius * baseMultiplier, radius * baseMultiplier, 1.0);
  mesh.renderOrder = 2;

  groundMeshes.push({
    mesh,
    baseMultiplier,
    rotSpeed
  });

  return mesh;
}

/**
 * Creates Volumetric Soft Mist Puff billboards (Option 2).
 * Camera-facing billboards with Gaussian radial alpha to eliminate any intersecting stick lines.
 */
function createVolumetricPuffCluster(puffRadius, puffHeight, count = 3) {
  const cluster = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const geom = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
    const mesh = new THREE.Mesh(geom, puffMaterial);

    // Distribute softly around the empty node
    const angle = (i / count) * Math.PI * 2;
    const dist = 0.25 + (i % 2) * 0.15;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = 0.15 + i * 0.18;

    mesh.position.set(x, y, z);

    const mult = 0.9 + (i % 3) * 0.2;
    mesh.scale.set(puffRadius * mult, puffHeight * mult, 1.0);
    mesh.renderOrder = 2;

    puffBillboards.push({
      mesh,
      basePos: new THREE.Vector3(x, y, z),
      baseMultiplier: mult,
      seed: i * 2.14,
      floatSpeed: 0.6 + (i % 3) * 0.25
    });

    cluster.add(mesh);
  }

  return cluster;
}

/**
 * Builds the ethereal Altar Mist system and attaches to fog1 and fire001 empty nodes.
 */
export function createAltarMist(fog1Node, fire001Node) {
  if (!fog1Node && !fire001Node) {
    console.warn('[AltarMist] Neither "fog1" nor "fire001" found in scene.');
    return;
  }

  // 1. Ground Mist ShaderMaterial (Option 1 - Additive Gaussian pool)
  groundMaterial = new THREE.ShaderMaterial({
    uniforms: altarMistUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uFlowSpeed;
      uniform vec3 uGroundColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        vec2 uv = vUv - 0.5;
        float dist = length(uv) * 2.0;

        // Ultra-smooth Gaussian falloff (Zero hard polygon edges)
        float radial = exp(-dist * dist * 3.2);
        radial *= smoothstep(1.0, 0.15, dist);

        // Slow organic swirl
        float angle = atan(uv.y, uv.x);
        vec2 polarUv = vec2(dist * 2.2 - uTime * 0.05 * uFlowSpeed, angle * 1.5);
        float n1 = snoise(polarUv);
        float n2 = snoise(vec2(vUv.x * 3.0 + uTime * 0.04 * uFlowSpeed, vUv.y * 3.0 - uTime * 0.03 * uFlowSpeed));
        float curlNoise = (n1 * 0.6 + n2 * 0.4) * 0.5 + 0.5;

        float alpha = radial * mix(0.75, 1.25, curlNoise) * uOpacity;

        // Ethereal luminous blue-cyan tone
        vec3 col = mix(uGroundColor, uRimColor, clamp(radial * curlNoise * 1.2, 0.0, 1.0));

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  // 2. Volumetric Soft Mist Puff ShaderMaterial (Option 2 - Additive Billboard Clouds)
  puffMaterial = new THREE.ShaderMaterial({
    uniforms: altarMistUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPuffDensity;
      uniform float uFlowSpeed;
      uniform vec3 uPuffColor;
      uniform vec3 uRimColor;

      ${simplexNoiseGLSL}

      void main() {
        vec2 uv = vUv - 0.5;
        float dist = length(uv) * 2.0;

        // Smooth Gaussian cloud puff - ZERO hard borders
        float radial = exp(-dist * dist * 3.5);
        radial *= smoothstep(1.0, 0.12, dist);

        // Ascending drifting smoke turbulence
        vec2 billowUv = vUv * 2.5 + vec2(
          sin(uTime * 0.12 * uFlowSpeed + vUv.y * 2.0) * 0.15,
          -uTime * 0.14 * uFlowSpeed
        );
        float n1 = snoise(billowUv);
        float n2 = snoise(billowUv * 2.2 + vec2(0.4, -uTime * 0.09 * uFlowSpeed));
        float billow = (n1 * 0.65 + n2 * 0.35) * 0.5 + 0.5;

        float alpha = radial * billow * uOpacity * uPuffDensity;

        // Luminous twilight sapphire to glowing cyan highlight
        vec3 col = mix(uPuffColor, uRimColor, clamp(radial * 1.3, 0.0, 1.0));

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const r = rawAltarMistConfig.groundRadius;
  const pr = rawAltarMistConfig.puffRadius;
  const ph = rawAltarMistConfig.puffHeight;

  // 3. Build Node 1: fog1 (Right side of altar)
  if (fog1Node) {
    fog1RootGroup = new THREE.Group();
    fog1RootGroup.name = 'AltarMist_Fog1_Group';
    const off = rawAltarMistConfig.offsetFog1;
    fog1RootGroup.position.set(off[0], off[1], off[2]);

    const sc = rawAltarMistConfig.scale;
    if (Array.isArray(sc)) fog1RootGroup.scale.set(sc[0], sc[1], sc[2]);

    // Option 1: Horizontal Ground Creeping Mist pool
    fog1RootGroup.add(createGroundMistLayer(r, 0.02, 0.0, 1.0, 0.03));
    fog1RootGroup.add(createGroundMistLayer(r, 0.04, Math.PI * 0.4, 1.15, -0.025));

    // Option 2: Volumetric Soft Billboard Puffs (3 billboards)
    fog1RootGroup.add(createVolumetricPuffCluster(pr, ph, 3));

    fog1Node.add(fog1RootGroup);
    console.log('[AltarMist] Attached luminous mist shroud to "fog1" at', fog1Node.position.toArray());
  }

  // 4. Build Node 2: fire.001 / fire001 (Left / rear side of altar)
  if (fire001Node) {
    fire001RootGroup = new THREE.Group();
    fire001RootGroup.name = 'AltarMist_Fire001_Group';
    const off = rawAltarMistConfig.offsetFire001;
    fire001RootGroup.position.set(off[0], off[1], off[2]);

    const sc = rawAltarMistConfig.scale;
    if (Array.isArray(sc)) fire001RootGroup.scale.set(sc[0], sc[1], sc[2]);

    // Option 1: Horizontal Ground Creeping Mist pool
    fire001RootGroup.add(createGroundMistLayer(r, 0.02, Math.PI * 0.3, 1.05, 0.028));
    fire001RootGroup.add(createGroundMistLayer(r, 0.04, Math.PI * 0.7, 1.2, -0.022));

    // Option 2: Volumetric Soft Billboard Puffs (3 billboards)
    fire001RootGroup.add(createVolumetricPuffCluster(pr, ph, 3));

    fire001Node.add(fire001RootGroup);
    console.log('[AltarMist] Attached luminous mist shroud to "fire001" at', fire001Node.position.toArray());
  }
}

/**
 * Main animation update loop: dynamically aligns billboards to camera and updates time.
 */
export function updateAltarMist(elapsed, delta, camera) {
  if (!fog1RootGroup && !fire001RootGroup) return;

  altarMistUniforms.uTime.value = elapsed;

  const flow = rawAltarMistConfig.flowSpeed;

  // 1. Slow rotation of horizontal ground pools
  groundMeshes.forEach((item) => {
    item.mesh.rotation.z += delta * item.rotSpeed * flow;
  });

  // 2. Camera-facing billboards: orient smoothly to camera and apply gentle floating bob
  if (camera) {
    puffBillboards.forEach((item) => {
      // Dynamic billboard orientation: always faces the camera to eliminate edge-on sticks
      item.mesh.quaternion.copy(camera.quaternion);

      // Subtle atmospheric floating
      const floatY = Math.sin(elapsed * item.floatSpeed + item.seed) * 0.04;
      const floatX = Math.cos(elapsed * (item.floatSpeed * 0.8) + item.seed) * 0.03;
      item.mesh.position.y = item.basePos.y + floatY;
      item.mesh.position.x = item.basePos.x + floatX;
    });
  }
}

/**
 * Clean GPU memory disposal.
 */
export function cleanupAltarMist() {
  groundMeshes.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  groundMeshes = [];

  puffBillboards.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  puffBillboards = [];

  if (groundMaterial) {
    groundMaterial.dispose();
    groundMaterial = null;
  }

  if (puffMaterial) {
    puffMaterial.dispose();
    puffMaterial = null;
  }

  if (fog1RootGroup) {
    fog1RootGroup.parent?.remove(fog1RootGroup);
    fog1RootGroup = null;
  }

  if (fire001RootGroup) {
    fire001RootGroup.parent?.remove(fire001RootGroup);
    fire001RootGroup = null;
  }
}

/**
 * Current runtime state for testing & DevTools.
 */
export function getAltarMistState() {
  return {
    hasAltarMist: !!(fog1RootGroup || fire001RootGroup),
    fog1Active: !!fog1RootGroup,
    fire001Active: !!fire001RootGroup,
    groundLayersCount: groundMeshes.length,
    puffLayersCount: puffBillboards.length,
    opacity: altarMistUniforms.uOpacity.value
  };
}
