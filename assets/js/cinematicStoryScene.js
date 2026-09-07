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

  // 4. RENDER SCENE USING GLTF CAMERA
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

  // 7. Reset references
  camera = null;
  clock = null;
  starsMesh = null;
  starMeshes.length = 0;
  billboardMeshes.length = 0;
  cameraDuration = 0;
}
