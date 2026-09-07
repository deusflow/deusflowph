/**
 * assets/js/story/vfx/stars.js
 * 
 * Volumetric 3D Starfield & Scintillation Engine for DeusFlow Cinematic Story.
 * Fully compliant with AGENTS.md:
 * - De-grids rigid 2D planar star sheets from Blender into organic 3D star airspaces
 * - Quad-preserving 3D pseudo-random spatial displacement (X, Y, and canyon depth Z)
 * - Eliminates duplicate perimeter fence lines and stacked duplicate quads
 * - Multi-frequency scintillation & chromatic iridescence shader (warm amber -> sapphire -> diamond core)
 */
import * as THREE from 'three';
import { STAR_DISPERSION_CONFIG } from '../storyConfig.js';

export const starUniforms = {
  uTime: { value: 0 }
};

const starMeshes = [];

/**
 * Deterministic pseudo-random hash per quad.
 */
function pHash(seed, meshIndex = 0) {
  const s = Math.sin(seed * 12.9898 + (meshIndex + 1) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Detect whether a quad center lies on the rigid rectangular perimeter from Blender.
 */
function isPerimeter(cx, cy) {
  const onLeft = Math.abs(cx - (-5.317)) < 0.06;
  const onRight = Math.abs(cx - 0.127) < 0.06;
  const onBottom = Math.abs(cy - (-3.556)) < 0.06;
  const onTop = Math.abs(cy - 1.889) < 0.06;
  return onLeft || onRight || onBottom || onTop;
}

/**
 * Disperses Blender's rigid linear grid rows & deduplicates stacked quads.
 */
export function disperseStarGeometry(child, meshIndex = 0) {
  if (!child.geometry || !child.geometry.attributes.position) return;

  // Clone geometry so each mesh instance gets independent, unshared vertex buffers
  child.geometry = child.geometry.clone();
  const pos = child.geometry.attributes.position;
  const v = pos.array;
  const quadCount = Math.floor(pos.count / 4);

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
        const h = pHash(q * 7.31 + 1.1, meshIndex);
        if (h < STAR_DISPERSION_CONFIG.borderCullRate) {
          shouldCull = true;
        }
      }
    } else if (isDuplicateLayer) {
      // In the interior, keep a portion of duplicate stars to enrich celestial volume without clustering
      const h = pHash(q * 11.17 + 2.3, meshIndex);
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
    scale = STAR_DISPERSION_CONFIG.minScale + pHash(q * 33.7 + 5.9, meshIndex) * (STAR_DISPERSION_CONFIG.maxScale - STAR_DISPERSION_CONFIG.minScale);

    // Organic spatial displacement
    // If it was on a border line, give it wider dispersal to break the line cleanly
    const jitterMagnitude = onBorder ? STAR_DISPERSION_CONFIG.jitterBorder : STAR_DISPERSION_CONFIG.jitterInterior;
    const jx = (pHash(q * 17.3 + 3.1, meshIndex) - 0.5) * 2.0 * jitterMagnitude;
    const jy = (pHash(q * 29.7 + 7.4, meshIndex) - 0.5) * 2.0 * jitterMagnitude;
    // 3D canyon depth: transforms flat 2D sheet into a volumetric celestial starfield
    const jz = (pHash(q * 43.1 + 11.8, meshIndex) - 0.5) * STAR_DISPERSION_CONFIG.depthSpreadZ;

    // Apply quad-preserving rigid displacement + center-relative scaling
    for (let k = 0; k < 4; k++) {
      const vi = (baseVertex + k) * 3;
      v[vi] = cx + (v[vi] - cx) * scale + jx;
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
 */
export function enhanceStarMaterial(mat) {
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
 * Ingests a candidate Mesh from GLTF traversal and configures starfield dispersion & shading.
 */
export function processStarMesh(child) {
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
  return child;
}

/**
 * Updates star time uniform in render loop.
 */
export function updateStars(time) {
  if (starMeshes.length > 0) {
    starUniforms.uTime.value = time;
  }
}

/**
 * Returns array of registered star meshes.
 */
export function getStarMeshes() {
  return starMeshes;
}

/**
 * Diagnostics & inspection utilities for tests and browser console.
 */
export function getStarStats() {
  return starMeshes.map((m) => {
    const pos = m.geometry.attributes.position;
    const quadCount = Math.floor(pos.count / 4);
    let activeQuads = 0;
    let culledQuads = 0;
    const activeCenters = [];

    for (let q = 0; q < quadCount; q++) {
      const i0 = q * 4 * 3;
      const i1 = (q * 4 + 1) * 3;
      const isZeroArea = (pos.array[i0] === pos.array[i1] &&
        pos.array[i0 + 1] === pos.array[i1 + 1] &&
        pos.array[i0 + 2] === pos.array[i1 + 2]);

      if (isZeroArea) {
        culledQuads++;
      } else {
        activeQuads++;
        const cx = (pos.array[i0] + pos.array[i1] + pos.array[(q * 4 + 2) * 3] + pos.array[(q * 4 + 3) * 3]) * 0.25;
        const cy = (pos.array[i0 + 1] + pos.array[i1 + 1] + pos.array[(q * 4 + 2) * 3 + 1] + pos.array[(q * 4 + 3) * 3 + 1]) * 0.25;
        activeCenters.push([cx, cy]);
      }
    }

    const xMap = new Map();
    const yMap = new Map();
    activeCenters.forEach((pt) => {
      const kx = pt[0].toFixed(2);
      const ky = pt[1].toFixed(2);
      xMap.set(kx, (xMap.get(kx) || 0) + 1);
      yMap.set(ky, (yMap.get(ky) || 0) + 1);
    });

    const maxColStars = Math.max(0, ...Array.from(xMap.values()));
    const maxRowStars = Math.max(0, ...Array.from(yMap.values()));
    const bb = m.geometry.boundingBox;
    const depthSpreadZ = bb ? (bb.max.z - bb.min.z) : 0;

    return {
      meshName: m.name,
      totalQuads: Math.floor(pos.count / 4),
      activeQuads,
      culledQuads,
      maxColStars,
      maxRowStars,
      depthSpreadZ,
      isDispersed: maxColStars <= 6 && maxRowStars <= 6 && depthSpreadZ > 1.5
    };
  });
}

export function getStarGeometryDetails() {
  return starMeshes.map((m) => {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const pos = m.geometry.attributes.position;
    const idx = m.geometry.index;
    return {
      name: m.name,
      vertexCount: pos.count,
      indexCount: idx ? idx.count : 0,
      bounds: {
        min: [m.geometry.boundingBox.min.x, m.geometry.boundingBox.min.y, m.geometry.boundingBox.min.z],
        max: [m.geometry.boundingBox.max.x, m.geometry.boundingBox.max.y, m.geometry.boundingBox.max.z]
      },
      firstVertices: [
        [pos.getX(0), pos.getY(0), pos.getZ(0)],
        [pos.getX(1), pos.getY(1), pos.getZ(1)],
        [pos.getX(2), pos.getY(2), pos.getZ(2)],
        [pos.getX(3), pos.getY(3), pos.getZ(3)],
        [pos.getX(4), pos.getY(4), pos.getZ(4)],
        [pos.getX(5), pos.getY(5), pos.getZ(5)],
        [pos.getX(6), pos.getY(6), pos.getZ(6)],
        [pos.getX(7), pos.getY(7), pos.getZ(7)]
      ],
      firstIndices: idx ? Array.from(idx.array.slice(0, 18)) : null
    };
  });
}

export function getStarQuadCenters(meshIdx = 0) {
  const m = starMeshes[meshIdx];
  if (!m) return [];
  const pos = m.geometry.attributes.position;
  const centers = [];
  for (let i = 0; i < pos.count; i += 4) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2) + pos.getX(i + 3)) * 0.25;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2) + pos.getY(i + 3)) * 0.25;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2) + pos.getZ(i + 3)) * 0.25;
    centers.push([cx, cy, cz]);
  }
  return centers;
}

export function getQuadVertices(meshIdx = 0, quadIdx = 0) {
  const m = starMeshes[meshIdx];
  if (!m) return [];
  const pos = m.geometry.attributes.position;
  const base = quadIdx * 4;
  if (base + 3 >= pos.count) return [];
  return [
    [pos.getX(base), pos.getY(base), pos.getZ(base)],
    [pos.getX(base + 1), pos.getY(base + 1), pos.getZ(base + 1)],
    [pos.getX(base + 2), pos.getY(base + 2), pos.getZ(base + 2)],
    [pos.getX(base + 3), pos.getY(base + 3), pos.getZ(base + 3)]
  ];
}

/**
 * Resets star cache on scene cleanup.
 */
export function cleanupStars() {
  starMeshes.length = 0;
  starUniforms.uTime.value = 0;
}
