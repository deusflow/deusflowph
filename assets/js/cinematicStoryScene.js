/**
 * ============================================================================
 * CINEMATIC STORY SCENE ENGINE (Vanilla Three.js ES Module)
 * ============================================================================
 * Architecture:
 * 1. Scene Initialization & GLTF Camera Override
 *    - Bypasses default perspective camera; uses authored camera named "Camera".
 *    - Explicitly bypasses Octree + Capsule collision calculation during this track.
 * 2. Scrollytelling Animation Split Logic (GSAP ScrollTrigger + Three.js AnimationMixer)
 *    - Scroll-driven camera path scrubbed via mixer.setTime(progress * duration).
 *    - Ambient looping animation for "Sketchfab_model" (Portal) in requestAnimationFrame.
 * 3. Transparent Plane Sorting & Billboards Fix (Cloud & Fog)
 *    - Traverses "Bilboard" and "FOG" planes; enforces depthWrite: false & transparent: true.
 *    - Runtime lookAt(camera.position) orientation per frame.
 * 4. Procedural Fog & Dynamic Twinkling Stars
 *    - THREE.Fog for seamless atmospheric blending.
 *    - Sinusoidal opacity modulation on "stars" mesh.
 * 5. Dynamic Window Resize & Deep GPU Memory Cleanup
 *    - Aspect ratio & projection matrix updates.
 *    - Complete disposal of textures, materials, geometries, and GSAP triggers.
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Timer } from 'three/addons/misc/Timer.js';

// Global / Module-level state for this sequence
let scene = null;
let camera = null;
let renderer = null;
let timer = null;
let animationFrameId = null;

// Animation Mixers (Split Architecture)
let cameraMixer = null;
let portalMixer = null;
let cameraDuration = 0;
let cameraClipEntries = [];

// --- GLTF Punctual Lights Configuration (KHR_lights_punctual) ---
// Easily fine-tune individual light brightness here without re-exporting the model.
// Clamps massive Blender export values (10,000 - 200,000) down to sane WebGL values (1.0 - 5.0).
export const STORY_LIGHT_CONFIG = {
  'base light to portal': 3.5,
  'contlight2': 2.8,
  'front light to portal': 3.0,
  'Point': 1.8,
  'portal l centr': 4.2
};

const gltfLights = new Map();

function getLightConfigIntensity(name) {
  if (!name) return null;
  if (STORY_LIGHT_CONFIG[name] !== undefined) return STORY_LIGHT_CONFIG[name];
  const spaced = name.replace(/_/g, ' ').trim();
  if (STORY_LIGHT_CONFIG[spaced] !== undefined) return STORY_LIGHT_CONFIG[spaced];
  const underscored = name.replace(/\s+/g, '_').trim();
  if (STORY_LIGHT_CONFIG[underscored] !== undefined) return STORY_LIGHT_CONFIG[underscored];
  const lower = spaced.toLowerCase();
  for (const [key, val] of Object.entries(STORY_LIGHT_CONFIG)) {
    if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) {
      return val;
    }
  }
  return null;
}

// Meshes & Billboards
const billboardMeshes = [];
let starsMesh = null;
const starMeshes = [];
const starUniforms = {
  uTime: { value: 0 }
};
const cameraWorldPos = new THREE.Vector3();
const meshWorldPos = new THREE.Vector3();

// GSAP ScrollTrigger reference for cleanup
let scrollTriggerInstance = null;

// Resize listener reference
let resizeHandler = null;

/**
 * Configuration for star spatial dispersion & line de-clustering
 */
const STAR_DISPERSION_CONFIG = {
  borderCullRate: 0.65,    // Dissolve 65% of stars along Blender's rigid bounding perimeter lines
  interiorDupeRate: 0.45,  // Keep 45% of interior duplicate quads to enrich 3D volume softly
  jitterBorder: 0.65,      // Spatial displacement for perimeter stars
  jitterInterior: 0.32,    // Spatial displacement for interior stars
  depthSpreadZ: 2.2,       // Volumetric 3D canyon depth spread (converts 2D sheet into 3D airspace)
  minScale: 0.50,          // Minimum quad scale (distant pinprick)
  maxScale: 1.35           // Maximum quad scale (radiant jewel)
};

/**
 * Disperses and dilutes rigid linear star rows and stacked duplicate quads:
 * 1. Clones child.geometry so each star mesh instance has independent geometry buffers.
 * 2. Identifies and dissolves the 500 stacked duplicate quads (quads 500..999 were exact twins of 0..499).
 * 3. Thins out the dense rectangular perimeter rows/columns from Blender (X ≈ -5.32, X ≈ 0.13, Y ≈ -3.56, Y ≈ 1.89).
 * 4. Applies quad-preserving 3D pseudo-random spatial displacement (X, Y, and canyon depth Z).
 * 5. Applies astronomical scale variations (delicate pinpricks to radiant jewels).
 */
function disperseStarGeometry(child, meshIndex = 0) {
  if (!child.geometry || !child.geometry.attributes.position) return;

  // Clone geometry so each mesh instance gets independent, unshared vertex buffers
  child.geometry = child.geometry.clone();
  const pos = child.geometry.attributes.position;
  const v = pos.array;
  const quadCount = Math.floor(pos.count / 4);

  // Deterministic pseudo-random hash per quad
  function pHash(seed) {
    const s = Math.sin(seed * 12.9898 + (meshIndex + 1) * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // Detect whether a quad center lies on the rigid rectangular perimeter from Blender
  function isPerimeter(cx, cy) {
    const onLeft = Math.abs(cx - (-5.317)) < 0.06;
    const onRight = Math.abs(cx - 0.127) < 0.06;
    const onBottom = Math.abs(cy - (-3.556)) < 0.06;
    const onTop = Math.abs(cy - 1.889) < 0.06;
    return onLeft || onRight || onBottom || onTop;
  }

  for (let q = 0; q < quadCount; q++) {
    const baseVertex = q * 4;
    // Compute quad center
    const cx = (v[baseVertex * 3] + v[(baseVertex + 1) * 3] + v[(baseVertex + 2) * 3] + v[(baseVertex + 3) * 3]) * 0.25;
    const cy = (v[baseVertex * 3 + 1] + v[(baseVertex + 1) * 3 + 1] + v[(baseVertex + 2) * 3 + 1] + v[(baseVertex + 3) * 3 + 1]) * 0.25;
    const cz = (v[baseVertex * 3 + 2] + v[(baseVertex + 1) * 3 + 2] + v[(baseVertex + 2) * 3 + 2] + v[(baseVertex + 3) * 3 + 2]) * 0.25;

    const isDuplicateLayer = q >= 500;
    const onBorder = isPerimeter(cx, cy);

    let scale = 1.0;
    let shouldCull = false;

    if (onBorder) {
      // Eliminate duplicate edge quads completely
      if (isDuplicateLayer) {
        shouldCull = true;
      } else {
        // Thin out dense edge line stars so the perimeter fence completely dissolves
        const h = pHash(q * 7.31 + 1.1);
        if (h < STAR_DISPERSION_CONFIG.borderCullRate) {
          shouldCull = true;
        }
      }
    } else if (isDuplicateLayer) {
      // In the interior, keep a portion of duplicate stars to enrich celestial volume without clustering
      const h = pHash(q * 11.17 + 2.3);
      if (h >= STAR_DISPERSION_CONFIG.interiorDupeRate) {
        shouldCull = true;
      }
    }

    if (shouldCull) {
      // Collapse quad to center (0 area) - GPU automatically discards zero-area degenerate triangles
      for (let k = 0; k < 4; k++) {
        const vi = (baseVertex + k) * 3;
        v[vi] = cx;
        v[vi + 1] = cy;
        v[vi + 2] = cz;
      }
      continue;
    }

    // Varied astronomical scale (magnitude): minScale to maxScale
    scale = STAR_DISPERSION_CONFIG.minScale + pHash(q * 33.7 + 5.9) * (STAR_DISPERSION_CONFIG.maxScale - STAR_DISPERSION_CONFIG.minScale);

    // Organic spatial displacement
    // If it was on a border line, give it wider dispersal to break the line cleanly
    const jitterMagnitude = onBorder ? STAR_DISPERSION_CONFIG.jitterBorder : STAR_DISPERSION_CONFIG.jitterInterior;
    const jx = (pHash(q * 17.3 + 3.1) - 0.5) * 2.0 * jitterMagnitude;
    const jy = (pHash(q * 29.7 + 7.4) - 0.5) * 2.0 * jitterMagnitude;
    // 3D canyon depth: transforms flat 2D sheet into a volumetric celestial starfield
    const jz = (pHash(q * 43.1 + 11.8) - 0.5) * STAR_DISPERSION_CONFIG.depthSpreadZ;

    // Apply quad-preserving rigid displacement + center-relative scaling
    for (let k = 0; k < 4; k++) {
      const vi = (baseVertex + k) * 3;
      v[vi]     = cx + (v[vi] - cx) * scale + jx;
      v[vi + 1] = cy + (v[vi + 1] - cy) * scale + jy;
      v[vi + 2] = cz + (v[vi + 2] - cz) * scale + jz;
    }
  }

  pos.needsUpdate = true;
  child.geometry.computeBoundingBox();
  child.geometry.computeBoundingSphere();
}

/**
 * Injects a multi-frequency star scintillation & chromatic iridescence shader.
 * - Every star quad has an independent phase & frequency derived from its 3D coordinates.
 * - Multi-frequency waves: slow atmospheric breathing + air flutter + sharp diamond sparkles.
 * - Chromatic iridescence: shifts dynamically between Hogwarts warm amber, deep burning ember,
 *   subtle celestial sapphire blue-white, and brilliant diamond white at peak glints.
 */
function enhanceStarMaterial(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = starUniforms.uTime;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vStarWorldPos;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStarWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vStarWorldPos;
      uniform float uTime;

      // Spatial hash for deterministic per-star phase & scintillation speed
      float starHash(vec3 p) {
        vec3 q = floor(p * 4.5);
        return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>

      // 1. Independent per-star phase & speed from unique 3D space position
      float sPhase = starHash(vStarWorldPos) * 6.2831853;
      float sFreq = 1.6 + fract(sPhase * 0.17) * 2.8;

      // 2. Multi-frequency organic scintillation:
      // a) Deep slow breathing swell
      float wave1 = sin(uTime * sFreq + sPhase);
      // b) Medium flutter
      float wave2 = sin(uTime * (sFreq * 3.6) + sPhase * 2.3);
      // c) High-frequency needle-sharp glimmers
      float wave3 = sin(uTime * (sFreq * 8.2) + sPhase * 4.9);

      // Normalized scintillation factor [0, 1]
      float rawTwinkle = 0.5 + 0.28 * wave1 + 0.14 * wave2 + 0.08 * wave3;
      // Exponential curve produces sharp celestial diamond glints / sparks
      float twinkle = pow(clamp(rawTwinkle, 0.0, 1.0), 2.2);

      // 3. Chromatic Iridescence / Atmospheric dispersion (переливание цвета):
      vec3 colAmber = vec3(1.0, 0.58, 0.16);  // Warm Hogwarts library gold/amber
      vec3 colWhite = vec3(1.0, 0.98, 0.93);  // Piercing diamond white core
      vec3 colPrism = vec3(0.68, 0.84, 1.0);  // Subtle celestial sapphire blue-white flare
      vec3 colEmber = vec3(1.0, 0.30, 0.05);  // Deep burning ember red-gold

      float colorPhase = sin(uTime * (sFreq * 1.3) + sPhase * 3.1);
      vec3 shimmerCol = mix(colAmber, colEmber, clamp(colorPhase, 0.0, 1.0));
      shimmerCol = mix(shimmerCol, colPrism, clamp(-colorPhase, 0.0, 1.0) * 0.45);
      // Flare up to brilliant diamond white at twinkle peaks
      shimmerCol = mix(shimmerCol, colWhite, smoothstep(0.60, 0.98, twinkle));

      // 4. Emissive radiance modulation
      float starlightIntensity = 1.6 + twinkle * 6.2;
      totalEmissiveRadiance = shimmerCol * starlightIntensity;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      // Modulate transparency dynamically so stars softly glimmer in opacity as well
      gl_FragColor.a *= clamp(0.35 + twinkle * 0.65, 0.0, 1.0);
      `
    );
  };
}

/**
 * ============================================================================
 * PROCEDURAL BLUE FIRE SYSTEM (Goblet of Fire style on fire.001 Empty node)
 * ============================================================================
 * 1. 3D Cross-quad Procedural Flame with ascending multi-octave Simplex noise.
 * 2. Soft camera-facing radial volumetric halo glow.
 * 3. Physical 3D polygonal rising sparks/embers (24 quads, NO gl_PointSize).
 * 4. Dynamic flickering PointLight casting atmospheric blue illumination on rocks.
 */
let blueFireGroup = null;
let blueFireLight = null;
let blueFireHaloMesh = null;
let blueFireSparksMesh = null;
let blueFireMaterial = null;
const blueFireUniforms = {
  uTime: { value: 0 }
};
const sparkDummy = new THREE.Object3D();
const SPARK_COUNT = 24;
const sparkData = [];
for (let i = 0; i < SPARK_COUNT; i++) {
  sparkData.push({
    speed: 0.35 + (i % 7) * 0.08,
    offset: (i * 0.137) % 1.0,
    radius: 0.08 + (i % 5) * 0.04,
    angleOffset: (i * 1.256) % (Math.PI * 2),
    baseScale: 0.7 + (i % 4) * 0.15
  });
}

const rawBlueFireConfig = {
  flameHeight: 1.45,
  flameWidth: 0.75,
  flameIntensity: 1.8,
  lightIntensity: 2.4,
  lightDistance: 7.5,
  lightDecay: 1.8,
  lightColor: 0x00c8ff,
  baseColor: new THREE.Color(0x011470),
  midColor: new THREE.Color(0x00d4ff),
  coreColor: new THREE.Color(0xf0fbff),
  scale: [1, 1, 1],
  offset: [0, 0, 0]
};

function applyBlueFireConfig(prop, val) {
  if (prop === 'lightColor' && blueFireLight) {
    blueFireLight.color.set(val);
  } else if (prop === 'lightDistance' && blueFireLight) {
    blueFireLight.distance = Number(val);
  } else if (prop === 'lightDecay' && blueFireLight) {
    blueFireLight.decay = Number(val);
  } else if (prop === 'lightIntensity' && blueFireLight) {
    rawBlueFireConfig.lightIntensity = Number(val);
  } else if (prop === 'flameIntensity' && blueFireMaterial && blueFireMaterial.uniforms.uIntensity) {
    blueFireMaterial.uniforms.uIntensity.value = Number(val);
  } else if (prop === 'baseColor' && blueFireMaterial && blueFireMaterial.uniforms.uColorBase) {
    if (val instanceof THREE.Color) blueFireMaterial.uniforms.uColorBase.value.copy(val);
    else blueFireMaterial.uniforms.uColorBase.value.set(val);
  } else if (prop === 'midColor' && blueFireMaterial && blueFireMaterial.uniforms.uColorMid) {
    if (val instanceof THREE.Color) blueFireMaterial.uniforms.uColorMid.value.copy(val);
    else blueFireMaterial.uniforms.uColorMid.value.set(val);
  } else if (prop === 'coreColor' && blueFireMaterial && blueFireMaterial.uniforms.uColorCore) {
    if (val instanceof THREE.Color) blueFireMaterial.uniforms.uColorCore.value.copy(val);
    else blueFireMaterial.uniforms.uColorCore.value.set(val);
  } else if (prop === 'scale' && blueFireGroup) {
    if (Array.isArray(val)) blueFireGroup.scale.set(val[0], val[1], val[2]);
    else blueFireGroup.scale.setScalar(Number(val));
  } else if (prop === 'offset' && blueFireGroup && Array.isArray(val)) {
    blueFireGroup.position.set(val[0], val[1], val[2]);
  }
}

const BLUE_FIRE_CONFIG = new Proxy(rawBlueFireConfig, {
  set(target, prop, val) {
    target[prop] = val;
    applyBlueFireConfig(prop, val);
    return true;
  }
});

function setBlueFireConfig(newConfig = {}) {
  if (!newConfig || typeof newConfig !== 'object') return BLUE_FIRE_CONFIG;
  for (const [key, val] of Object.entries(newConfig)) {
    BLUE_FIRE_CONFIG[key] = val;
  }
  console.log('[CinematicScene] BLUE_FIRE_CONFIG updated live:', BLUE_FIRE_CONFIG);
  return BLUE_FIRE_CONFIG;
}

if (typeof window !== 'undefined' && !window.BLUE_FIRE_CONFIG) {
  window.BLUE_FIRE_CONFIG = BLUE_FIRE_CONFIG;
  window.setBlueFireConfig = setBlueFireConfig;
}

function createBlueFireEffect(targetNode) {
  if (!targetNode) return;

  blueFireGroup = new THREE.Group();
  blueFireGroup.name = 'BlueFlameVfx';

  // Apply configurable initial scale and offset
  if (Array.isArray(BLUE_FIRE_CONFIG.scale)) {
    blueFireGroup.scale.set(BLUE_FIRE_CONFIG.scale[0], BLUE_FIRE_CONFIG.scale[1], BLUE_FIRE_CONFIG.scale[2]);
  } else if (typeof BLUE_FIRE_CONFIG.scale === 'number') {
    blueFireGroup.scale.setScalar(BLUE_FIRE_CONFIG.scale);
  }
  if (Array.isArray(BLUE_FIRE_CONFIG.offset)) {
    blueFireGroup.position.set(BLUE_FIRE_CONFIG.offset[0], BLUE_FIRE_CONFIG.offset[1], BLUE_FIRE_CONFIG.offset[2]);
  }

  // 1. 3D Intersecting Flame Planes (3 double-sided planes rotated at 0, 60, 120 deg)
  const flameGeom = new THREE.PlaneGeometry(BLUE_FIRE_CONFIG.flameWidth, BLUE_FIRE_CONFIG.flameHeight, 16, 24);
  flameGeom.translate(0, BLUE_FIRE_CONFIG.flameHeight * 0.5, 0);

  const flameMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: blueFireUniforms.uTime,
      uColorBase: { value: BLUE_FIRE_CONFIG.baseColor },
      uColorMid: { value: BLUE_FIRE_CONFIG.midColor },
      uColorCore: { value: BLUE_FIRE_CONFIG.coreColor },
      uIntensity: { value: BLUE_FIRE_CONFIG.flameIntensity }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Natural flame wind sway increasing with height
        float h = clamp(pos.y / 1.45, 0.0, 1.0);
        float swayX = sin(uTime * 3.8 + pos.y * 2.5) * 0.06 * h;
        float swayZ = cos(uTime * 3.1 + pos.y * 2.1) * 0.05 * h;
        pos.x += swayX;
        pos.z += swayZ;

        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColorBase;
      uniform vec3 uColorMid;
      uniform vec3 uColorCore;
      uniform float uIntensity;

      // 2D Simplex Noise
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

      void main() {
        vec2 uv = vUv;

        // Upward-ascending multi-octave flame turbulence
        vec2 scroll1 = vec2(uv.x * 2.8, uv.y * 3.4 - uTime * 2.8);
        vec2 scroll2 = vec2(uv.x * 5.4 + 0.5, uv.y * 6.8 - uTime * 4.4);
        float n1 = snoise(scroll1);
        float n2 = snoise(scroll2);
        float flameNoise = n1 * 0.65 + n2 * 0.35;

        // Organic flame teardrop silhouette
        float taper = (1.0 - uv.y) * sqrt(clamp(uv.y * 3.8, 0.0, 1.0));
        float dist = abs(uv.x - 0.5) * 2.0;

        float shape = smoothstep(taper, taper * 0.18, dist - flameNoise * 0.38 * (1.0 - uv.y * 0.45));
        // Soft base & tip fades
        shape *= smoothstep(0.0, 0.12, uv.y);
        shape *= smoothstep(1.0, 0.82, uv.y);

        if (shape <= 0.001) discard;

        // Color mapping: sapphire base -> cyan body -> diamond white core
        float coreMask = pow(clamp(shape, 0.0, 1.0), 2.2);
        vec3 col = mix(uColorBase, uColorMid, smoothstep(0.12, 0.55, shape));
        col = mix(col, uColorCore, smoothstep(0.65, 0.95, coreMask));

        float flicker = 0.88 + 0.12 * sin(uTime * 14.0 + uv.y * 4.0);
        vec3 finalColor = col * uIntensity * flicker;

        gl_FragColor = vec4(finalColor, shape * 0.92);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  blueFireMaterial = flameMat;

  const angles = [0, Math.PI / 3, (Math.PI * 2) / 3];
  angles.forEach((ang) => {
    const mesh = new THREE.Mesh(flameGeom, flameMat);
    mesh.rotation.y = ang;
    mesh.renderOrder = 4;
    blueFireGroup.add(mesh);
  });

  // 2. Soft Volumetric Radial Halo (Billboard)
  const haloGeom = new THREE.PlaneGeometry(1.6, 1.6);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: blueFireUniforms.uTime
    },
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
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float glow = exp(-3.2 * r * r);
        vec3 haloCol = mix(vec3(0.0, 0.82, 1.0), vec3(0.02, 0.22, 0.85), r);
        float pulse = 0.38 + 0.08 * sin(uTime * 7.5);
        gl_FragColor = vec4(haloCol * pulse * 1.5, glow * pulse);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  blueFireHaloMesh = new THREE.Mesh(haloGeom, haloMat);
  blueFireHaloMesh.position.set(0, 0.5, 0);
  blueFireHaloMesh.renderOrder = 4;
  blueFireGroup.add(blueFireHaloMesh);

  // 3. Physical 3D Polygonal Rising Sparks (Quads, NO gl_PointSize)
  const sparkGeom = new THREE.PlaneGeometry(0.038, 0.038);
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  blueFireSparksMesh = new THREE.InstancedMesh(sparkGeom, sparkMat, SPARK_COUNT);
  blueFireSparksMesh.renderOrder = 5;
  blueFireGroup.add(blueFireSparksMesh);

  // 4. Local Dynamic Light for Illuminating Canyon Rock Walls
  blueFireLight = new THREE.PointLight(
    BLUE_FIRE_CONFIG.lightColor,
    BLUE_FIRE_CONFIG.lightIntensity,
    BLUE_FIRE_CONFIG.lightDistance,
    BLUE_FIRE_CONFIG.lightDecay
  );
  blueFireLight.position.set(0, 0.5, 0.2);
  blueFireGroup.add(blueFireLight);

  // Attach to Blender empty node
  targetNode.add(blueFireGroup);
  console.log(`[CinematicScene] Procedural Blue Fire attached to node "${targetNode.name}" at [${targetNode.position.x.toFixed(2)}, ${targetNode.position.y.toFixed(2)}, ${targetNode.position.z.toFixed(2)}]`);
}

function updateBlueFire(time, cam) {
  if (!blueFireGroup) return;

  blueFireUniforms.uTime.value = time;

  // 1. Dynamic light flicker & live config sync
  if (blueFireLight) {
    blueFireLight.color.set(BLUE_FIRE_CONFIG.lightColor);
    blueFireLight.distance = BLUE_FIRE_CONFIG.lightDistance;
    blueFireLight.decay = BLUE_FIRE_CONFIG.lightDecay;
    blueFireLight.intensity = BLUE_FIRE_CONFIG.lightIntensity * (0.85 + 0.15 * Math.sin(time * 12.0) + 0.08 * Math.sin(time * 23.5));
  }

  // 2. Halo billboard orientation towards camera
  if (blueFireHaloMesh && cam) {
    blueFireHaloMesh.quaternion.copy(cam.quaternion);
  }

  // 3. Update rising 3D polygonal sparks
  if (blueFireSparksMesh && cam) {
    for (let i = 0; i < SPARK_COUNT; i++) {
      const data = sparkData[i];
      const p = ((time * data.speed + data.offset) % 1.0);
      const y = p * 1.8;
      const angle = time * 2.2 + data.angleOffset;
      const r = data.radius * (0.3 + p * 0.7);
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;

      sparkDummy.position.set(x, y, z);
      sparkDummy.quaternion.copy(cam.quaternion);

      // Fade/shrink near top and near bottom
      const scaleFade = Math.sin(p * Math.PI) * data.baseScale;
      sparkDummy.scale.setScalar(Math.max(0.001, scaleFade));
      sparkDummy.updateMatrix();

      blueFireSparksMesh.setMatrixAt(i, sparkDummy.matrix);
    }
    blueFireSparksMesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Initializes the cinematic scroll-driven sequence.
 * 
 * @param {Object} options Configuration parameters
 * @param {HTMLCanvasElement} options.canvas The target WebGL canvas
 * @param {HTMLElement|string} [options.scrollContainer] The element driving GSAP scroll (defaults to document.body)
 * @param {string} [options.glbUrl='/assets/models/Story3.glb'] Path to the cinematic GLB asset
 * @param {Function} [options.onProgress] Optional loading progress callback (0 - 100)
 * @param {Function} [options.onLoaded] Optional callback fired once the scene is ready and playing
 * @returns {Promise<Object>} API object containing { scene, camera, renderer, cleanup }
 */
export async function initCinematicScene({
  canvas,
  scrollContainer = document.body,
  glbUrl = '/assets/models/Story3.glb',
  onProgress = null,
  onLoaded = null
}) {
  if (!canvas) {
    throw new Error('[CinematicScene] Canvas element is required for initialization.');
  }

  // Ensure any previous instance on this canvas is cleanly unmounted
  cleanup();

  // --------------------------------------------------------------------------
  // 1. SCENE, TIMER & PROCEDURAL FOG (Requirement 4)
  // --------------------------------------------------------------------------
  scene = new THREE.Scene();
  timer = new Timer();

  // Atmospheric Procedural Fog to naturally blend static clouds into background
  // Hogwarts Library / Canyon Twilight: Dark amber-black (#0d0a08)
  const fogColor = new THREE.Color(0x0d0a08);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 15, 200);

  // Default atmospheric lighting (warm library glow + ambient fill)
  const ambientLight = new THREE.AmbientLight(0xffedd8, 1.2);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffe8cf, 1.5);
  keyLight.position.set(-15, 35, 20);
  scene.add(keyLight);

  // --------------------------------------------------------------------------
  // 2. RENDERER SETUP
  // --------------------------------------------------------------------------
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // --------------------------------------------------------------------------
  // 3. LOAD GLB & CAMERA OVERRIDE (Requirement 1)
  // --------------------------------------------------------------------------
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      glbUrl,
      (gltf) => {
        const root = gltf.scene;
        scene.add(root);

        // --- REQUIREMENT 1: EXTRACT GLTF CAMERA ---
        // Do NOT create a default perspective camera. Use the authored 'Camera' node.
        let extractedCamera = gltf.cameras.find((c) => c.name === 'Camera');

        if (!extractedCamera) {
          // Traverse hierarchy in case camera is a child node in scene graph
          root.traverse((node) => {
            if (node.isCamera && (node.name === 'Camera' || !extractedCamera)) {
              extractedCamera = node;
            }
          });
        }

        if (!extractedCamera) {
          console.error('[CinematicScene] Critical: Camera named "Camera" not found in GLTF!');
          // Graceful fallback only if asset is missing camera
          extractedCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
          scene.add(extractedCamera);
        }

        camera = extractedCamera;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        // ====================================================================
        // ARCHITECTURAL DIRECTIVE: CAPSULE + OCTREE COLLISION BYPASS
        // ====================================================================
        // In free-roaming mode, your update loop typically calculates:
        //   playerCapsule.translate(...);
        //   worldOctree.capsuleIntersect(playerCapsule);
        //   camera.position.copy(playerCapsule.getCenter());
        //
        // FOR THIS CINEMATIC SCROLL SEQUENCE:
        // All capsule translation and Octree physics collision MUST BE BYPASSED.
        // The camera's translation and orientation are 100% authored in the GLTF
        // 'CameraAction' track. Calculating octree collisions here would fight
        // with the baked animation and cause severe positional jitter.
        // Notice in animate() below: No collision checks are performed.
        // ====================================================================

        // --------------------------------------------------------------------
        // 4. ANIMATION SPLIT LOGIC (Requirement 2)
        // ALL animation clips (Camera, Clouds, and any other baked movement)
        // are assigned to the scroll-driven GSAP mixer (mixer.setTime()).
        // The ONLY animation in continuous autoplay loop (RAF) is Sketchfab_model (the portal).
        // --------------------------------------------------------------------
        const scrollClips = [];
        const portalClips = [];

        // Identify the portal root node and all its descendant node names
        const portalNode = root.getObjectByName('Sketchfab_model') || root.getObjectByName('portal');
        const portalNodeNames = new Set();
        if (portalNode) {
          portalNode.traverse((obj) => {
            if (obj.name) portalNodeNames.add(obj.name.toLowerCase());
          });
        }

        function isPortalAnimation(clip) {
          const nameLower = clip.name.toLowerCase();
          // Explicit name match
          if (nameLower.includes('sketchfab') || nameLower.includes('portal')) return true;
          // Target match: check if tracks target Sketchfab_model hierarchy
          if (portalNodeNames.size > 0) {
            const targetsPortal = clip.tracks.some((track) => {
              const trackTargetName = track.name.split('.')[0].toLowerCase();
              return portalNodeNames.has(trackTargetName);
            });
            if (targetsPortal) return true;
          }
          // Fallback for default Sketchfab export take
          return nameLower.includes('take 001');
        }

        gltf.animations.forEach((clip) => {
          if (isPortalAnimation(clip)) {
            portalClips.push(clip);
          } else {
            scrollClips.push(clip);
          }
        });

        console.log(`[CinematicScene] Animations sorted: ${scrollClips.length} scroll-driven clips (${scrollClips.map(c => c.name).join(', ')}), ${portalClips.length} continuous portal clips (${portalClips.map(c => c.name).join(', ')})`);

        // A) SCROLL-DRIVEN MIXER: GSAP ScrollTrigger drives Camera, Clouds, and all scene movement
        cameraClipEntries = [];
        if (scrollClips.length > 0) {
          // Master timeline duration across all scroll-driven clips
          cameraDuration = scrollClips.reduce((max, clip) => Math.max(max, clip.duration), 0);

          scrollClips.forEach((clip) => {
            // Extend clip duration to master timeline so Three.js LoopOnce doesn't prematurely clamp/reset
            clip.duration = Math.max(clip.duration, cameraDuration);

            const mixer = new THREE.AnimationMixer(root);
            const action = mixer.clipAction(clip);
            action.clampWhenFinished = true;
            action.setLoop(THREE.LoopOnce);
            action.play();
            cameraClipEntries.push({ mixer, action, clip });
          });

          cameraMixer = cameraClipEntries[0]?.mixer || null;

          // Hook scroll scrub to GSAP ScrollTrigger
          setupCameraScrollTrigger(scrollContainer);
        }

        // B) PORTAL MIXER: ONLY Sketchfab_model (the portal) in continuous autoplay loop
        if (portalClips.length > 0) {
          portalMixer = new THREE.AnimationMixer(portalNode || root);
          
          portalClips.forEach((clip) => {
            const action = portalMixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            action.play();
          });
        }

        // --------------------------------------------------------------------
        billboardMeshes.length = 0;
        gltfLights.clear();
        let fireTargetNode = null;

        root.traverse((child) => {
          // PUNCTUAL LIGHTS SCALING: detect GLTF punctual lights and scale down massive raw values
          if (child.isLight) {
            const configIntensity = getLightConfigIntensity(child.name) ?? (child.parent ? getLightConfigIntensity(child.parent.name) : null);
            const rawIntensity = child.intensity;
            if (configIntensity !== null) {
              child.intensity = configIntensity;
            } else if (child.intensity > 10) {
              // Safe clamp / remap fallback for any unconfigured punctual light (clamps to 1.0 - 5.0)
              child.intensity = THREE.MathUtils.clamp(child.intensity / 2500, 1.0, 5.0);
            }
            gltfLights.set(child.name, child);
            console.log(`[CinematicScene] Scaled punctual light "${child.name}" (${child.type}): raw ${rawIntensity.toFixed(1)} -> scaled ${child.intensity.toFixed(2)}`);
          }

          // Identify target empty node for Procedural Blue Fire (prioritizing fog2, fallback to fire001)
          if (child.name === 'fog2' || child.name.toLowerCase() === 'fog2') {
            fireTargetNode = child;
          } else if (!fireTargetNode && (child.name === 'fire001' || child.name === 'fire.001')) {
            fireTargetNode = child;
          }

          if (child.isMesh) {
            // UNLIT FIX for Cloud_Poly and Sky: prevent blown out lighting
            if (child.name === 'Cloud_Poly' || child.name === 'Sky') {
              const oldMat = child.material;
              const tex = oldMat.map || oldMat.emissiveMap;
              const col = (oldMat.color && (oldMat.color.r > 0 || oldMat.color.g > 0 || oldMat.color.b > 0))
                ? oldMat.color.clone()
                : (oldMat.emissive ? oldMat.emissive.clone() : new THREE.Color(0xffffff));

              child.material = new THREE.MeshBasicMaterial({
                map: tex,
                color: col,
                side: oldMat.side || THREE.DoubleSide,
                transparent: oldMat.transparent || false,
                opacity: oldMat.opacity !== undefined ? oldMat.opacity : 1.0,
                depthWrite: oldMat.depthWrite !== undefined ? oldMat.depthWrite : true
              });
              child.material.needsUpdate = true;
              if (oldMat.dispose) oldMat.dispose();
            }

            // Check for Bilboard vs static ground FOG
            const isBillboard = child.name.startsWith('Bilboard');
            const isGroundFog = child.name.startsWith('FOG') || child.name.toLowerCase().includes('fog');

            if (isBillboard) {
              billboardMeshes.push(child);

              // Layered density distribution: ~43% of billboards become soft, airy misty halos
              const num = parseInt(child.name.replace(/\D/g, ''), 10) || 0;
              const isMistLayer = (num % 3 === 0 || num % 7 === 0);

              if (isMistLayer) {
                // Clone material so mist opacity does not affect dense shared cloud materials
                child.material = Array.isArray(child.material)
                  ? child.material.map((m) => m.clone())
                  : child.material.clone();

                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat) => {
                  mat.transparent = true;
                  mat.depthWrite = false;
                  mat.alphaTest = 0.001; // Buttery soft gradient edges without dither cutouts
                  mat.side = THREE.DoubleSide;
                  mat.opacity = 0.44;     // Delicate, luminous atmospheric mist
                  mat.needsUpdate = true;
                });

                child.userData.baseOpacity = 0.44;
                child.userData.isMist = true;
                // Expand slightly (+18%) to form an enveloping misty halo around cloud cores
                child.scale.multiplyScalar(1.18);
                child.renderOrder = 3;
              } else {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat) => {
                  mat.transparent = true;
                  mat.depthWrite = false;
                  mat.alphaTest = 0.01;
                  mat.side = THREE.DoubleSide;
                  mat.opacity = 0.95;     // Dense cloud core
                  mat.needsUpdate = true;
                });

                child.userData.baseOpacity = 0.95;
                child.userData.isMist = false;
                child.renderOrder = 2;
              }
            } else if (isGroundFog) {
              // Static ground fog layer (M_BottomFog): do NOT add to billboardMeshes (NO lookAt)!
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                mat.transparent = true;
                mat.depthWrite = false;
                mat.alphaTest = 0.01;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });

              child.renderOrder = 2;
            }

            // ----------------------------------------------------------------
            // 6. DYNAMIC STARS IDENTIFICATION (Requirement 4)
            // ----------------------------------------------------------------
            if (child.name.toLowerCase() === 'stars' || child.name.toLowerCase().includes('star')) {
              starsMesh = child;
              const starMeshIndex = starMeshes.length;
              starMeshes.push(child);

              // Disperse Blender's rigid linear grid rows & deduplicate stacked quads
              disperseStarGeometry(child, starMeshIndex);

              const starMaterials = Array.isArray(child.material) ? child.material : [child.material];
              starMaterials.forEach((mat) => {
                mat.transparent = true;
                mat.depthWrite = false;
                mat.needsUpdate = true;

                // Inject celestial scintillation & chromatic iridescence shader
                if (!mat.userData.hasStarShader) {
                  mat.userData.hasStarShader = true;
                  enhanceStarMaterial(mat);
                }
              });
              child.renderOrder = 3;
            }
          }
        });

        // Attach Procedural Blue Fire to fire.001 empty node once traversal is complete
        if (fireTargetNode) {
          createBlueFireEffect(fireTargetNode);
        }

        // --------------------------------------------------------------------
        // 7. WINDOW RESIZE HANDLING (Requirement 5)
        // --------------------------------------------------------------------
        resizeHandler = onWindowResize;
        window.addEventListener('resize', resizeHandler);

        // Initial setup for camera position
        if (cameraMixer) {
          cameraMixer.setTime(0.001);
        }

        // Start Render Loop
        animate();

        if (onLoaded) onLoaded();

        resolve({
          scene,
          camera,
          renderer,
          cleanup
        });
      },
      (progressEvent) => {
        if (progressEvent.total > 0 && onProgress) {
          const pct = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(pct);
        }
      },
      (error) => {
        console.error('[CinematicScene] Error loading GLB scene:', error);
        reject(error);
      }
    );
  });
}

/**
 * Binds the camera animation progress strictly to GSAP ScrollTrigger.
 */
function setupCameraScrollTrigger(scrollContainer) {
  if (typeof window === 'undefined' || !window.ScrollTrigger) {
    console.warn('[CinematicScene] GSAP ScrollTrigger not found on window. Camera scrub disabled.');
    return;
  }

  // Kill existing trigger if reinitializing
  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
  }

  scrollTriggerInstance = window.ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0, // Smooth interpolation lag for premium cinematic feel
    onUpdate: (self) => {
      const p = Math.max(0, Math.min(1, self.progress));
      if (cameraClipEntries.length > 0) {
        cameraClipEntries.forEach(({ mixer, action, clip }) => {
          action.paused = false;
          const targetTime = Math.min(p * clip.duration, Math.max(0, clip.duration - 0.0001));
          mixer.setTime(targetTime);
        });
      } else if (cameraMixer && cameraDuration > 0) {
        const targetTime = Math.min(p * cameraDuration, Math.max(0, cameraDuration - 0.0001));
        cameraMixer.setTime(targetTime);
      }
    }
  });
}

/**
 * Per-frame animation loop.
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  if (timer) timer.update();
  const delta = timer ? timer.getDelta() : 0.016;

  // --------------------------------------------------------------------------
  // [COLLISION BYPASS]: Free-roam Octree+Capsule physics loop is bypassed here!
  // The camera follows the GLTF keyframed trajectory without obstacle interference.
  // --------------------------------------------------------------------------

  // 1. AMBIENT PORTAL ANIMATION LOOP (Runs continuously even when scrolling is stopped)
  if (portalMixer) {
    portalMixer.update(delta);
  }

  // 2. Orient all Bilboard planes towards camera & calculate smooth camera near-dissolve
  if (camera && billboardMeshes.length > 0) {
    camera.getWorldPosition(cameraWorldPos);
    for (let i = 0; i < billboardMeshes.length; i++) {
      const mesh = billboardMeshes[i];
      mesh.lookAt(cameraWorldPos);

      // Camera distance near-fade: dissolves billboards gently when camera flies in close
      // Prevents 2D flat plane clipping artifacts across the near clipping plane
      const baseOp = mesh.userData.baseOpacity ?? 1.0;
      mesh.getWorldPosition(meshWorldPos);
      const distToCam = cameraWorldPos.distanceTo(meshWorldPos);

      const nearFadeDistance = 2.5;
      const minClipDistance = 0.8;
      if (distToCam < nearFadeDistance) {
        const factor = Math.max(0, Math.min(1, (distToCam - minClipDistance) / (nearFadeDistance - minClipDistance)));
        const targetOpacity = baseOp * factor;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => { m.opacity = targetOpacity; });
        } else if (mesh.material) {
          mesh.material.opacity = targetOpacity;
        }
      } else {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => { m.opacity = baseOp; });
        } else if (mesh.material && mesh.material.opacity !== baseOp) {
          mesh.material.opacity = baseOp;
        }
      }
    }
  }

  // 3. Dynamic Celestial Stars Scintillation & Chromatic Shimmer
  if (starMeshes.length > 0) {
    starUniforms.uTime.value = (timer && timer.getElapsed)
      ? timer.getElapsed()
      : performance.now() * 0.001;
  } else if (starsMesh && starsMesh.material) {
    const starSpeed = 0.0035;
    const opacity = 0.58 + Math.sin(Date.now() * starSpeed) * 0.38;
    if (Array.isArray(starsMesh.material)) {
      starsMesh.material.forEach((mat) => { mat.opacity = opacity; });
    } else {
      starsMesh.material.opacity = opacity;
    }
  }

  // 4. Update Procedural Blue Fire Effect (Flame, sparks, halo & light flicker)
  const elapsedFireSec = (timer && timer.getElapsed)
    ? timer.getElapsed()
    : performance.now() * 0.001;
  updateBlueFire(elapsedFireSec, camera);

  // 5. RENDER SCENE USING GLTF CAMERA
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Updates GLTF camera projection and WebGL viewport on window resize.
 */
function onWindowResize() {
  if (!camera || !renderer) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

/**
 * Robust cleanup function to prevent memory leaks in Single Page Applications (SPA).
 * Disposes all GPU resources, geometries, materials, textures, and kills GSAP ScrollTriggers.
 */
export function cleanup() {
  // 1. Cancel requestAnimationFrame loop
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 2. Remove window resize listener
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  // 3. Kill GSAP ScrollTrigger
  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
    scrollTriggerInstance = null;
  }

  // 4. Stop and uncache animation mixers
  if (cameraMixer) {
    cameraMixer.stopAllAction();
    cameraMixer.uncacheRoot(cameraMixer.getRoot());
    cameraMixer = null;
  }
  if (portalMixer) {
    portalMixer.stopAllAction();
    portalMixer.uncacheRoot(portalMixer.getRoot());
    portalMixer = null;
  }

  // 5. Deep GPU Resource Disposal (Geometries, Materials, Textures)
  if (scene) {
    scene.traverse((object) => {
      // Dispose geometry
      if (object.geometry) {
        object.geometry.dispose();
      }

      // Dispose materials & associated textures
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((mat) => {
          // Dispose all textures attached to the material
          for (const key of Object.keys(mat)) {
            const value = mat[key];
            if (value && typeof value === 'object' && 'dispose' in value && typeof value.dispose === 'function') {
              value.dispose();
            }
          }
          mat.dispose();
        });
      }
    });

    // Detach all child nodes
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    scene = null;
  }

  // 6. Dispose WebGL Renderer
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  // Dispose Blue Fire Effect
  if (blueFireGroup) {
    blueFireGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    if (blueFireGroup.parent) {
      blueFireGroup.parent.remove(blueFireGroup);
    }
    blueFireGroup = null;
    blueFireLight = null;
    blueFireHaloMesh = null;
    blueFireSparksMesh = null;
  }

  // 7. Reset references
  camera = null;
  clock = null;
  starsMesh = null;
  starMeshes.length = 0;
  billboardMeshes.length = 0;
  cameraDuration = 0;
}
