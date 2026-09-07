/**
 * assets/js/story/vfx/blueFire.js
 * 
 * Procedural Blue Fire VFX ("Goblet of Fire") for DeusFlow Cinematic Story.
 * Fully compliant with AGENTS.md:
 * - 3D intersecting physical polygonal quads (double-sided lighting)
 * - Simplex 3D upward curl turbulence with dynamic stream power
 * - Soft camera-facing radial volumetric halo
 * - Physical 3D rising sparks/embers (24 quads in InstancedMesh, NO gl_PointSize)
 * - Dynamic flickering PointLight illuminating canyon walls
 */
import * as THREE from 'three';
import { BLUE_FIRE_CONFIG, rawBlueFireConfig, registerBlueFireConfigListener } from '../storyConfig.js';

let blueFireGroup = null;
let blueFireLight = null;
let blueFireHaloMesh = null;
let blueFireHaloMat = null;
let blueFireSparksMesh = null;
let blueFireMaterial = null;
let flameMeshes = [];

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

/**
 * Live configuration applicator: called whenever BLUE_FIRE_CONFIG is modified in the console or in code.
 */
export function applyBlueFireConfig(prop, val) {
  if (prop === 'lightColor' && blueFireLight) {
    blueFireLight.color.set(val);
  } else if (prop === 'lightDistance' && blueFireLight) {
    rawBlueFireConfig.lightDistance = Number(val);
    const avgScale = blueFireGroup ? (blueFireGroup.scale.x + blueFireGroup.scale.y + blueFireGroup.scale.z) / 3 : 1;
    blueFireLight.distance = Number(val) * Math.max(0.001, avgScale);
  } else if (prop === 'lightDecay' && blueFireLight) {
    blueFireLight.decay = Number(val);
  } else if (prop === 'lightIntensity' && blueFireLight) {
    rawBlueFireConfig.lightIntensity = Number(val);
  } else if (prop === 'flameIntensity') {
    const num = Number(val);
    rawBlueFireConfig.flameIntensity = num;
    if (blueFireMaterial && blueFireMaterial.uniforms.uIntensity) {
      blueFireMaterial.uniforms.uIntensity.value = num;
    }
    if (blueFireHaloMat && blueFireHaloMat.uniforms.uIntensity) {
      blueFireHaloMat.uniforms.uIntensity.value = num;
    }
  } else if (prop === 'flamePower' && blueFireMaterial && blueFireMaterial.uniforms.uFlamePower) {
    blueFireMaterial.uniforms.uFlamePower.value = Number(val);
  } else if (prop === 'flameTaper' && blueFireMaterial && blueFireMaterial.uniforms.uFlameTaper) {
    const num = Number(val);
    rawBlueFireConfig.flameTaper = num;
    blueFireMaterial.uniforms.uFlameTaper.value = num;
  } else if (prop === 'bottomSpread' && blueFireMaterial && blueFireMaterial.uniforms.uBottomSpread) {
    const num = Number(val);
    rawBlueFireConfig.bottomSpread = num;
    blueFireMaterial.uniforms.uBottomSpread.value = num;
  } else if (prop === 'bottomDensity' && blueFireMaterial && blueFireMaterial.uniforms.uBottomDensity) {
    const num = Number(val);
    rawBlueFireConfig.bottomDensity = num;
    blueFireMaterial.uniforms.uBottomDensity.value = num;
  } else if (prop === 'flameHeight') {
    const h = Number(val);
    rawBlueFireConfig.flameHeight = h;
    flameMeshes.forEach((m) => { m.scale.y = h; });
    if (blueFireHaloMesh) {
      blueFireHaloMesh.scale.y = h * 1.3;
      blueFireHaloMesh.position.y = h * 0.45;
    }
    if (blueFireLight) {
      blueFireLight.position.y = h * 0.4;
    }
  } else if (prop === 'flameWidth') {
    const w = Number(val);
    rawBlueFireConfig.flameWidth = w;
    flameMeshes.forEach((m) => { m.scale.x = w; m.scale.z = w; });
    if (blueFireHaloMesh) {
      blueFireHaloMesh.scale.x = w * 2.2;
    }
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
    let sx = 1, sy = 1, sz = 1;
    if (Array.isArray(val)) {
      sx = Number(val[0]) || 1;
      sy = Number(val[1]) || 1;
      sz = Number(val[2]) || 1;
    } else {
      sx = sy = sz = Number(val) || 1;
    }
    blueFireGroup.scale.set(sx, sy, sz);
    // Scale point light distance proportionally so extreme scales (like 0.001) visibly shrink the light glow too
    if (blueFireLight) {
      const avg = (sx + sy + sz) / 3;
      blueFireLight.distance = (Number(rawBlueFireConfig.lightDistance) || 7.5) * Math.max(0.001, avg);
    }
  } else if (prop === 'offset' && blueFireGroup && Array.isArray(val)) {
    blueFireGroup.position.set(Number(val[0]) || 0, Number(val[1]) || 0, Number(val[2]) || 0);
  }
}

// Hook reactive Proxy changes to the 3D scene
registerBlueFireConfigListener(applyBlueFireConfig);

/**
 * Initializes and attaches the Procedural Blue Fire VFX to the target empty node.
 */
export function createBlueFireEffect(targetNode) {
  if (!targetNode) return null;

  blueFireGroup = new THREE.Group();
  blueFireGroup.name = 'BlueFlameVfx';

  // Apply configurable initial scale and offset
  let sx = 1, sy = 1, sz = 1;
  if (Array.isArray(BLUE_FIRE_CONFIG.scale)) {
    sx = Number(BLUE_FIRE_CONFIG.scale[0]) || 1;
    sy = Number(BLUE_FIRE_CONFIG.scale[1]) || 1;
    sz = Number(BLUE_FIRE_CONFIG.scale[2]) || 1;
  } else if (typeof BLUE_FIRE_CONFIG.scale === 'number') {
    sx = sy = sz = Number(BLUE_FIRE_CONFIG.scale) || 1;
  }
  blueFireGroup.scale.set(sx, sy, sz);

  if (Array.isArray(BLUE_FIRE_CONFIG.offset)) {
    blueFireGroup.position.set(
      Number(BLUE_FIRE_CONFIG.offset[0]) || 0,
      Number(BLUE_FIRE_CONFIG.offset[1]) || 0,
      Number(BLUE_FIRE_CONFIG.offset[2]) || 0
    );
  }

  // 1. 3D Intersecting Flame Planes (3 double-sided planes rotated at 0, 60, 120 deg)
  // Base unit geometry (1.0 x 1.0) anchored at bottom center
  const flameGeom = new THREE.PlaneGeometry(1.0, 1.0, 16, 24);
  flameGeom.translate(0, 0.5, 0);

  const flameMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: blueFireUniforms.uTime,
      uColorBase: { value: BLUE_FIRE_CONFIG.baseColor },
      uColorMid: { value: BLUE_FIRE_CONFIG.midColor },
      uColorCore: { value: BLUE_FIRE_CONFIG.coreColor },
      uIntensity: { value: BLUE_FIRE_CONFIG.flameIntensity },
      uFlamePower: { value: BLUE_FIRE_CONFIG.flamePower },
      uFlameTaper: { value: BLUE_FIRE_CONFIG.flameTaper ?? 2.2 },
      uBottomSpread: { value: BLUE_FIRE_CONFIG.bottomSpread ?? 1.2 },
      uBottomDensity: { value: BLUE_FIRE_CONFIG.bottomDensity ?? 1.8 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uFlamePower;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Natural flame wind sway increasing with height (scaled by flamePower)
        float h = clamp(pos.y, 0.0, 1.0);
        float swayX = sin(uTime * 3.8 + pos.y * 2.5) * (0.05 * uFlamePower) * h;
        float swayZ = cos(uTime * 3.1 + pos.y * 2.1) * (0.04 * uFlamePower) * h;
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
      uniform float uFlamePower;
      uniform float uFlameTaper;
      uniform float uBottomSpread;
      uniform float uBottomDensity;

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

        // Upward-ascending multi-octave flame turbulence (speed tied to flamePower)
        float speed = max(0.25, uFlamePower);
        vec2 scroll1 = vec2(uv.x * 2.8, uv.y * 3.4 - uTime * (2.8 * speed));
        vec2 scroll2 = vec2(uv.x * 5.4 + 0.5, uv.y * 6.8 - uTime * (4.4 * speed));
        float n1 = snoise(scroll1);
        float n2 = snoise(scroll2);
        float flameNoise = n1 * 0.65 + n2 * 0.35;

        // Organic flame silhouette with configurable base width and top taper:
        float normalizedY = clamp(uv.y, 0.0, 1.0);
        float topTaper = pow(max(0.0, 1.0 - normalizedY), uFlameTaper);
        float baseFullness = mix(uBottomSpread, 1.0, clamp(normalizedY * 3.5, 0.0, 1.0));
        float taper = topTaper * baseFullness;

        float dist = abs(uv.x - 0.5) * 2.0;
        // Edge shape with upward tongue noise
        float noiseAmount = flameNoise * 0.38 * (1.0 - normalizedY * 0.4);
        float shape = smoothstep(taper, taper * 0.15, dist - noiseAmount);

        // Soft ground contact fade (only softens bottom 4% so base is solid and touches ground)
        shape *= smoothstep(0.0, 0.04, uv.y);

        // Vertical reach / flame stream power cutoff:
        float tipReach = clamp(0.40 + 0.45 * uFlamePower, 0.25, 0.98);
        shape *= smoothstep(tipReach, tipReach - 0.22, uv.y);

        if (shape <= 0.001) discard;

        // Color mapping: sapphire base -> cyan body -> diamond white core
        float coreMask = pow(clamp(shape, 0.0, 1.0), 2.2);
        vec3 col = mix(uColorBase, uColorMid, smoothstep(0.12, 0.55, shape));
        col = mix(col, uColorCore, smoothstep(0.65, 0.95, coreMask));

        // Density modulation: dense and saturated at bottom, soft and airy at top
        float heightDensity = mix(uBottomDensity, 0.5, clamp(normalizedY / tipReach, 0.0, 1.0));

        float flicker = 0.88 + 0.12 * sin(uTime * 14.0 + uv.y * 4.0);
        vec3 finalColor = col * uIntensity * flicker * heightDensity;

        gl_FragColor = vec4(finalColor, shape * clamp(heightDensity * 0.85, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  blueFireMaterial = flameMat;
  flameMeshes = [];

  const angles = [0, Math.PI / 3, (Math.PI * 2) / 3];
  angles.forEach((ang) => {
    const mesh = new THREE.Mesh(flameGeom, flameMat);
    mesh.rotation.y = ang;
    mesh.scale.set(BLUE_FIRE_CONFIG.flameWidth, BLUE_FIRE_CONFIG.flameHeight, BLUE_FIRE_CONFIG.flameWidth);
    mesh.renderOrder = 4;
    blueFireGroup.add(mesh);
    flameMeshes.push(mesh);
  });

  // 2. Soft Volumetric Radial Halo (Billboard)
  const haloGeom = new THREE.PlaneGeometry(1.0, 1.0);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: blueFireUniforms.uTime,
      uIntensity: { value: BLUE_FIRE_CONFIG.flameIntensity }
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
      uniform float uIntensity;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float glow = exp(-3.2 * r * r);
        vec3 haloCol = mix(vec3(0.0, 0.82, 1.0), vec3(0.02, 0.22, 0.85), r);
        float pulse = 0.38 + 0.08 * sin(uTime * 7.5);
        float intensityFactor = clamp(uIntensity / 8.8, 0.05, 3.5);
        gl_FragColor = vec4(haloCol * pulse * 1.5 * intensityFactor, glow * pulse * intensityFactor);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  blueFireHaloMat = haloMat;
  blueFireHaloMesh = new THREE.Mesh(haloGeom, haloMat);
  blueFireHaloMesh.scale.set(BLUE_FIRE_CONFIG.flameWidth * 2.4, BLUE_FIRE_CONFIG.flameHeight * 1.4, 1.0);
  blueFireHaloMesh.position.set(0, BLUE_FIRE_CONFIG.flameHeight * 0.30, 0);
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
  const initAvgScale = (blueFireGroup.scale.x + blueFireGroup.scale.y + blueFireGroup.scale.z) / 3;
  blueFireLight = new THREE.PointLight(
    BLUE_FIRE_CONFIG.lightColor,
    BLUE_FIRE_CONFIG.lightIntensity,
    BLUE_FIRE_CONFIG.lightDistance * Math.max(0.001, initAvgScale),
    BLUE_FIRE_CONFIG.lightDecay
  );
  blueFireLight.position.set(0, BLUE_FIRE_CONFIG.flameHeight * 0.4, 0.1);
  blueFireGroup.add(blueFireLight);

  // Attach to Blender empty node
  targetNode.add(blueFireGroup);
  console.log(`[BlueFire] Procedural Blue Fire attached to node "${targetNode.name}" at [${targetNode.position.x.toFixed(2)}, ${targetNode.position.y.toFixed(2)}, ${targetNode.position.z.toFixed(2)}]`);

  return blueFireGroup;
}

/**
 * Updates the flame animation, flickering light, sparks, and billboard halo every frame.
 */
export function updateBlueFire(time, cam) {
  if (!blueFireGroup) return;

  blueFireUniforms.uTime.value = time;

  // 1. Dynamic light flicker & live config sync
  if (blueFireLight) {
    const avgScale = (blueFireGroup.scale.x + blueFireGroup.scale.y + blueFireGroup.scale.z) / 3;
    blueFireLight.color.set(BLUE_FIRE_CONFIG.lightColor);
    blueFireLight.distance = (Number(rawBlueFireConfig.lightDistance) || 7.5) * Math.max(0.001, avgScale);
    blueFireLight.decay = BLUE_FIRE_CONFIG.lightDecay;
    blueFireLight.intensity = BLUE_FIRE_CONFIG.lightIntensity * (0.85 + 0.15 * Math.sin(time * 12.0) + 0.08 * Math.sin(time * 23.5));
  }

  // 2. Halo billboard orientation towards camera
  if (blueFireHaloMesh && cam) {
    blueFireHaloMesh.quaternion.copy(cam.quaternion);
  }

  // 3. Update rising 3D polygonal sparks (height tied to flameHeight and flamePower)
  if (blueFireSparksMesh && cam) {
    const currentH = (Number(rawBlueFireConfig.flameHeight) || 1.35) * (Number(rawBlueFireConfig.flamePower) || 0.85);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const data = sparkData[i];
      const p = ((time * data.speed + data.offset) % 1.0);
      const y = p * currentH * 1.35;
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
 * Returns debug state for browser testing and inspection.
 */
export function getBlueFireState() {
  return {
    hasBlueFire: !!blueFireGroup,
    nodeName: blueFireGroup?.parent?.name || null,
    pos: blueFireGroup?.parent?.position
      ? [blueFireGroup.parent.position.x, blueFireGroup.parent.position.y, blueFireGroup.parent.position.z]
      : null,
    intensity: blueFireLight ? blueFireLight.intensity : 0,
    config: BLUE_FIRE_CONFIG
  };
}

/**
 * Cleans up and disposes WebGL resources allocated by Blue Fire.
 */
export function cleanupBlueFire() {
  if (!blueFireGroup) return;

  if (blueFireGroup.parent) {
    blueFireGroup.parent.remove(blueFireGroup);
  }

  flameMeshes.forEach((mesh) => {
    if (mesh.geometry) mesh.geometry.dispose();
  });
  flameMeshes = [];

  if (blueFireMaterial) {
    blueFireMaterial.dispose();
    blueFireMaterial = null;
  }

  if (blueFireHaloMesh) {
    if (blueFireHaloMesh.geometry) blueFireHaloMesh.geometry.dispose();
    if (blueFireHaloMesh.material) blueFireHaloMesh.material.dispose();
    blueFireHaloMesh = null;
  }
  blueFireHaloMat = null;

  if (blueFireSparksMesh) {
    if (blueFireSparksMesh.geometry) blueFireSparksMesh.geometry.dispose();
    if (blueFireSparksMesh.material) blueFireSparksMesh.material.dispose();
    blueFireSparksMesh = null;
  }

  if (blueFireLight) {
    blueFireLight.dispose();
    blueFireLight = null;
  }

  blueFireGroup = null;
}

export const createBlueFire = createBlueFireEffect;
