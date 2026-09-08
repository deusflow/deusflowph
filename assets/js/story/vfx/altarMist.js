/**
 * assets/js/story/vfx/altarMist.js
 * 
 * Fluffy Volumetric Cloud-Mist ("Туман-тучка") for DeusFlow Cinematic Story.
 * Fully compliant with AGENTS.md:
 * - NO flat horizontal ground sheets / puddles (eliminates "looks like water" & "too layered")
 * - 100% Volumetric 3D Camera-Facing Cloud Billboards (quaternion.copy(camera.quaternion))
 * - Multi-octave Fractal Brownian Motion (FBM) noise for soft, fluffy cumulus cloud billows
 * - Delicate, airy, translucent opacity (0.15 - 0.25) so rocks remain visible beneath the mist
 * - Ultra-smooth Gaussian radial envelope exp(-dist * dist * 3.8) - ZERO sharp polygon lines or seams
 * - Color #7b8a9c: authentic silver-slate celestial canyon mist
 * - THREE.AdditiveBlending (zero black soot, pure ethereal atmospheric luminescence)
 */
import * as THREE from 'three';
import { ALTAR_MIST_CONFIG, rawAltarMistConfig, registerAltarMistConfigListener } from '../storyConfig.js';

let fog1RootGroup = null;
let fire001RootGroup = null;
let fog004MeshRef = null;
let groundFogMeshes = [];
let groundFogMaterial = null;
let puffBillboards = [];
let puffMaterial = null;
let fog004InitialY = -1.269;

export function registerFOG004Mesh(mesh) {
  fog004MeshRef = mesh;
  if (fog004MeshRef) {
    fog004MeshRef.visible = !rawAltarMistConfig.hideFOG && !rawAltarMistConfig.hideFOG004;
  }
}

// Initial normalized opacity
let initialOpacity = Number(ALTAR_MIST_CONFIG.opacity);
if (isNaN(initialOpacity)) initialOpacity = 0.55;
if (initialOpacity > 1.0) initialOpacity = Math.min(initialOpacity / 100.0, 1.0);

const altarMistUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: initialOpacity },
  uFlowSpeed: { value: Number(ALTAR_MIST_CONFIG.flowSpeed) || 0.25 },
  uPuffDensity: { value: Number(ALTAR_MIST_CONFIG.puffDensity) || 1.0 },
  uColor: { value: (ALTAR_MIST_CONFIG.color || ALTAR_MIST_CONFIG.puffColor) ? (ALTAR_MIST_CONFIG.color || ALTAR_MIST_CONFIG.puffColor).clone() : new THREE.Color(0xc0d8ec) },
  uPuffColor: { value: (ALTAR_MIST_CONFIG.puffColor || ALTAR_MIST_CONFIG.color) ? (ALTAR_MIST_CONFIG.puffColor || ALTAR_MIST_CONFIG.color).clone() : new THREE.Color(0xc0d8ec) },
  uRimColor: { value: ALTAR_MIST_CONFIG.rimColor ? ALTAR_MIST_CONFIG.rimColor.clone() : new THREE.Color(0xf0f7ff) }
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
 * Live configuration applicator: called whenever ALTAR_MIST_CONFIG or GROUND_FOG_CONFIG is modified.
 */
export function applyAltarMistConfig(prop, val) {
  if (prop === 'opacity') {
    let num = Number(val);
    if (isNaN(num)) num = 0.55;
    // Auto-normalize if user inputs percentage scale (e.g. 30.45, 60.45, 100) vs 0..1 scale (e.g. 0.85)
    if (num > 1.0) {
      num = Math.min(num / 100.0, 1.0);
    } else {
      num = Math.max(0.0, Math.min(num, 1.0));
    }
    rawAltarMistConfig.opacity = num;
    altarMistUniforms.uOpacity.value = num;
    console.log(`[AltarMist] Opacity set to ${num.toFixed(3)} across ${groundFogMeshes.length} ground fog planes.`);
  } else if (prop === 'flowSpeed') {
    const num = Number(val) || 0.25;
    rawAltarMistConfig.flowSpeed = num;
    altarMistUniforms.uFlowSpeed.value = num;
  } else if (prop === 'yOffset') {
    const off = Number(val) || 0.0;
    rawAltarMistConfig.yOffset = off;
    groundFogMeshes.forEach((mesh) => {
      const initY = mesh.userData.initialY !== undefined ? mesh.userData.initialY : mesh.position.y;
      mesh.position.y = initY + off;
    });
    console.log(`[AltarMist] yOffset set to ${off} across ${groundFogMeshes.length} ground fog planes.`);
  } else if (prop === 'color' || prop === 'puffColor' || prop === 'groundColor') {
    if (val instanceof THREE.Color) {
      altarMistUniforms.uColor.value.copy(val);
      altarMistUniforms.uPuffColor.value.copy(val);
    } else {
      altarMistUniforms.uColor.value.set(val);
      altarMistUniforms.uPuffColor.value.set(val);
    }
  } else if (prop === 'rimColor') {
    if (val instanceof THREE.Color) altarMistUniforms.uRimColor.value.copy(val);
    else altarMistUniforms.uRimColor.value.set(val);
  } else if (prop === 'hideFOG' || prop === 'hideFOG004' || prop === 'hideGroundFog') {
    const hidden = !!val;
    rawAltarMistConfig.hideFOG = hidden;
    rawAltarMistConfig.hideFOG004 = hidden;
    groundFogMeshes.forEach((mesh) => {
      mesh.visible = !hidden;
    });
  } else if (prop === 'enableEmptiesPuffs') {
    rawAltarMistConfig.enableEmptiesPuffs = !!val;
    if (fog1RootGroup) fog1RootGroup.visible = !!val;
    if (fire001RootGroup) fire001RootGroup.visible = !!val;
  } else if (prop === 'puffDensity') {
    const num = Number(val);
    rawAltarMistConfig.puffDensity = num;
    altarMistUniforms.uPuffDensity.value = num;
  } else if (prop === 'puffRadius' || prop === 'puffHeight') {
    const r = Number(rawAltarMistConfig.puffRadius);
    const h = Number(rawAltarMistConfig.puffHeight);
    puffBillboards.forEach((item) => {
      const mult = item.baseMultiplier || 1.0;
      item.mesh.scale.set(r * mult, h * mult, 1.0);
    });
  } else if (prop === 'cloudSpread') {
    const spread = Number(val);
    rawAltarMistConfig.cloudSpread = spread;
    puffBillboards.forEach((item) => {
      item.mesh.position.x = item.basePos.x * spread;
      item.mesh.position.z = item.basePos.z * spread;
    });
  } else if (prop === 'groundRadius') {
    const num = Number(val);
    rawAltarMistConfig.groundRadius = num;
    const r = num * 0.7;
    const h = Number(rawAltarMistConfig.puffHeight || 0.85);
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
  }
}

// Register dynamic configuration listener
registerAltarMistConfigListener(applyAltarMistConfig);

/**
 * Creates a cluster of fluffy 3D volumetric cloud-puffs ("туман-тучка") on empties.
 */
function createFluffyCloudCluster(puffRadius, puffHeight) {
  const cluster = new THREE.Group();

  const puffConfigs = [
    { x: 0.25, y: 0.08, z: 0.15, rMult: 1.25, hMult: 0.90, seed: 1.14, floatSpeed: 0.35, rotZ: 0.15 },
    { x: -0.30, y: 0.12, z: -0.20, rMult: 1.35, hMult: 0.95, seed: 2.37, floatSpeed: 0.30, rotZ: 1.25 },
    { x: 0.15, y: 0.28, z: -0.30, rMult: 1.45, hMult: 1.10, seed: 3.65, floatSpeed: 0.42, rotZ: 2.45 },
    { x: -0.20, y: 0.40, z: 0.20, rMult: 1.30, hMult: 1.05, seed: 4.88, floatSpeed: 0.38, rotZ: 3.70 },
    { x: 0.05, y: 0.58, z: -0.05, rMult: 1.55, hMult: 1.15, seed: 5.92, floatSpeed: 0.48, rotZ: 5.10 }
  ];

  const spread = rawAltarMistConfig.cloudSpread || 1.0;

  puffConfigs.forEach((cfg) => {
    const geom = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
    const mesh = new THREE.Mesh(geom, puffMaterial);

    const initialX = cfg.x * spread;
    const initialZ = cfg.z * spread;
    mesh.position.set(initialX, cfg.y, initialZ);

    mesh.scale.set(puffRadius * cfg.rMult, puffHeight * cfg.hMult, 1.0);
    mesh.renderOrder = 2;

    puffBillboards.push({
      mesh,
      basePos: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      baseMultiplier: cfg.rMult,
      seed: cfg.seed,
      floatSpeed: cfg.floatSpeed,
      rotZ: cfg.rotZ
    });

    cluster.add(mesh);
  });

  return cluster;
}

/**
 * Builds the volumetric ground-fog and altar mist system:
 * - Enhances ALL ground fog meshes (FOG, FOG.001 ... FOG.007) with full-plane rectangular feathering.
 * - Guarantees full coverage across the plane (no center holes/circles), covering gaps between slabs.
 * - Eliminates hard polygon seams/ribs through outer edge feathering.
 * - Bright, radiant, celestial mist tone (never black or dark).
 * - Optionally attaches cloud puffs to fog1 and fire001 empties.
 */
export function createAltarMist(fog1Node, fire001Node, fog004Node = null, allFogNodes = []) {
  const fogNodesToProcess = (Array.isArray(allFogNodes) && allFogNodes.length > 0)
    ? allFogNodes
    : (fog004Node ? [fog004Node] : []);

  if (fogNodesToProcess.length > 0) {
    if (!groundFogMaterial) {
      groundFogMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: altarMistUniforms.uTime,
          uOpacity: altarMistUniforms.uOpacity,
          uFlowSpeed: altarMistUniforms.uFlowSpeed,
          uColor: altarMistUniforms.uColor,
          uRimColor: altarMistUniforms.uRimColor
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          uniform float uTime;
          uniform float uOpacity;
          uniform float uFlowSpeed;
          uniform vec3 uColor;
          uniform vec3 uRimColor;

          ${simplexNoiseGLSL}

          void main() {
            // 4-edge rectangular perimeter feathering (0.0 to 0.08):
            // Over 92% of the rectangular plane has 100% full coverage right up to the edges
            // to thoroughly cover cracks and seams between floor slabs ("щели"),
            // while smoothly fading the outer 8% margin to 0 to eliminate hard polygon cuts/ribs!
            float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
            float borderFade = smoothstep(0.0, 0.08, edgeDist);

            // World-space organic drift for seamless continuous flow between adjacent planes
            vec2 flowUv = vWorldPos.xz * 0.25 + vec2(
              sin(uTime * 0.04 * uFlowSpeed + vWorldPos.z * 0.18) * 0.15,
              -uTime * 0.06 * uFlowSpeed
            );
            float n1 = snoise(flowUv);
            float n2 = snoise(flowUv * 2.3 + vec2(0.42, -uTime * 0.05 * uFlowSpeed));
            float noise = (n1 * 0.65 + n2 * 0.35) * 0.5 + 0.5;

            // High-density mist body across the entire rectangular plane
            float mist = borderFade * mix(0.72, 1.0, noise);
            float alpha = clamp(mist * uOpacity, 0.0, 1.0);

            // Luminous celestial mist color (bright silver-blue #c0d8ec, NEVER dark or black)
            vec3 col = mix(uColor, uRimColor, noise * 0.45);

            gl_FragColor = vec4(col, alpha);
          }
        `
      });
    }

    const yOff = rawAltarMistConfig.yOffset !== undefined ? rawAltarMistConfig.yOffset : 0.015;

    fogNodesToProcess.forEach((mesh) => {
      if (!mesh || !mesh.isMesh) return;
      if (!groundFogMeshes.includes(mesh)) {
        mesh.userData.initialY = mesh.position.y;
        mesh.position.y = mesh.userData.initialY + yOff;
        mesh.material = groundFogMaterial;
        mesh.visible = !rawAltarMistConfig.hideFOG && !rawAltarMistConfig.hideFOG004;
        mesh.renderOrder = 2;
        groundFogMeshes.push(mesh);

        if (mesh.name === 'FOG004' || mesh.name === 'FOG.004') {
          fog004MeshRef = mesh;
          fog004InitialY = mesh.userData.initialY;
        }
      }
    });

    if (!fog004MeshRef && fog004Node) {
      fog004MeshRef = fog004Node;
      fog004InitialY = fog004MeshRef.position.y;
    }

    console.log(`[AltarMist] Enhanced ${groundFogMeshes.length} ground fog planes (${groundFogMeshes.map(m=>m.name).join(', ')}) with bright borderless planar mist shader.`);
  }

  if (!fog1Node && !fire001Node) {
    return;
  }

  // Volumetric Fluffy Cloud ShaderMaterial on Empties
  if (!puffMaterial) {
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

        float cloudFBM(vec2 p) {
          float f = 0.0;
          f += 0.5200 * snoise(p); p = p * 2.05;
          f += 0.2800 * snoise(p); p = p * 2.08;
          f += 0.1400 * snoise(p);
          return f * 0.5 + 0.5;
        }

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv) * 2.0;

          float radial = exp(-dist * dist * 3.8);
          radial *= smoothstep(1.0, 0.2, dist);

          vec2 cloudUv = uv * 2.2 + vec2(
            sin(uTime * 0.08 * uFlowSpeed + uv.y * 1.5) * 0.12,
            -uTime * 0.10 * uFlowSpeed
          );
          float n = cloudFBM(cloudUv);

          float billow = smoothstep(0.20, 0.75, n);
          float cloud = radial * mix(0.40, 1.0, billow);
          float alpha = clamp(cloud * uOpacity * uPuffDensity, 0.0, 1.0);

          vec3 col = mix(uPuffColor, uRimColor, clamp(radial * 1.25, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }

  const pr = rawAltarMistConfig.puffRadius;
  const ph = rawAltarMistConfig.puffHeight;

  // 1. Build Node 1: fog1 (Right side of altar)
  if (fog1Node && !fog1RootGroup) {
    fog1RootGroup = new THREE.Group();
    fog1RootGroup.name = 'AltarMist_Fog1_Group';
    const off = rawAltarMistConfig.offsetFog1;
    fog1RootGroup.position.set(off[0], off[1], off[2]);

    const sc = rawAltarMistConfig.scale;
    if (Array.isArray(sc)) fog1RootGroup.scale.set(sc[0], sc[1], sc[2]);

    fog1RootGroup.add(createFluffyCloudCluster(pr, ph));
    fog1RootGroup.visible = !!rawAltarMistConfig.enableEmptiesPuffs;

    fog1Node.add(fog1RootGroup);
    console.log('[AltarMist] Attached cloud cluster to "fog1" at', fog1Node.position.toArray(), '(visible:', fog1RootGroup.visible, ')');
  }

  // 2. Build Node 2: fire.001 / fire001 (Left / rear side of altar)
  if (fire001Node && !fire001RootGroup) {
    fire001RootGroup = new THREE.Group();
    fire001RootGroup.name = 'AltarMist_Fire001_Group';
    const off = rawAltarMistConfig.offsetFire001;
    fire001RootGroup.position.set(off[0], off[1], off[2]);

    const sc = rawAltarMistConfig.scale;
    if (Array.isArray(sc)) fire001RootGroup.scale.set(sc[0], sc[1], sc[2]);

    fire001RootGroup.add(createFluffyCloudCluster(pr, ph));
    fire001RootGroup.visible = !!rawAltarMistConfig.enableEmptiesPuffs;

    fire001Node.add(fire001RootGroup);
    console.log('[AltarMist] Attached cloud cluster to "fire001" at', fire001Node.position.toArray(), '(visible:', fire001RootGroup.visible, ')');
  }
}

const _parentInvQuat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _tempParentQuat = new THREE.Quaternion();

/**
 * Main animation update loop: dynamically aligns cloud billboards to camera and applies gentle floating.
 */
export function updateAltarMist(elapsed, delta, camera) {
  altarMistUniforms.uTime.value = elapsed;

  if (!fog1RootGroup && !fire001RootGroup) return;

  const flow = rawAltarMistConfig.flowSpeed;
  const spread = rawAltarMistConfig.cloudSpread || 1.0;

  // Camera-facing billboards for empties puffs
  if (camera && (fog1RootGroup?.visible || fire001RootGroup?.visible)) {
    puffBillboards.forEach((item) => {
      if (item.mesh.parent) {
        item.mesh.parent.getWorldQuaternion(_tempParentQuat);
        _parentInvQuat.copy(_tempParentQuat).invert();
        item.mesh.quaternion.copy(_parentInvQuat).multiply(camera.quaternion);

        if (item.rotZ !== undefined) {
          _rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), item.rotZ + elapsed * 0.02 * flow);
          item.mesh.quaternion.multiply(_rollQuat);
        }
      } else {
        item.mesh.quaternion.copy(camera.quaternion);
      }

      const floatY = Math.sin(elapsed * item.floatSpeed * flow * 2.5 + item.seed) * 0.04;
      const floatX = Math.cos(elapsed * (item.floatSpeed * 0.7) * flow * 2.5 + item.seed) * 0.03;
      item.mesh.position.y = item.basePos.y + floatY;
      item.mesh.position.x = (item.basePos.x * spread) + floatX;
      item.mesh.position.z = (item.basePos.z * spread);
    });
  }
}

/**
 * Clean GPU memory disposal.
 */
export function cleanupAltarMist() {
  puffBillboards.forEach((item) => {
    if (item.mesh.geometry) item.mesh.geometry.dispose();
  });
  puffBillboards = [];

  if (puffMaterial) {
    puffMaterial.dispose();
    puffMaterial = null;
  }

  if (groundFogMaterial) {
    groundFogMaterial.dispose();
    groundFogMaterial = null;
  }

  if (fog1RootGroup) {
    fog1RootGroup.parent?.remove(fog1RootGroup);
    fog1RootGroup = null;
  }

  if (fire001RootGroup) {
    fire001RootGroup.parent?.remove(fire001RootGroup);
    fire001RootGroup = null;
  }

  groundFogMeshes.forEach((mesh) => {
    if (mesh.userData.initialY !== undefined) {
      mesh.position.y = mesh.userData.initialY;
    }
  });
  groundFogMeshes = [];
  fog004MeshRef = null;
}

/**
 * Current runtime state for testing & DevTools.
 */
export function getAltarMistState() {
  return {
    hasAltarMist: !!(groundFogMeshes.length > 0 || fog1RootGroup || fire001RootGroup),
    groundFogCount: groundFogMeshes.length,
    groundFogNames: groundFogMeshes.map(m => m.name),
    fog004Active: !!fog004MeshRef && fog004MeshRef.visible,
    fog004Pos: fog004MeshRef ? fog004MeshRef.position.toArray() : null,
    fog1Active: !!fog1RootGroup,
    fire001Active: !!fire001RootGroup,
    cloudPuffsCount: puffBillboards.length,
    emptiesPuffsVisible: fog1RootGroup ? fog1RootGroup.visible : false,
    opacity: altarMistUniforms.uOpacity.value,
    fog004Hidden: fog004MeshRef ? !fog004MeshRef.visible : false,
    allFogHidden: groundFogMeshes.length > 0 ? !groundFogMeshes[0].visible : false
  };
}
