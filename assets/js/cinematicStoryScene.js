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

// Meshes & Billboards
const billboardMeshes = [];
let starsMesh = null;
const cameraWorldPos = new THREE.Vector3();

// GSAP ScrollTrigger reference for cleanup
let scrollTriggerInstance = null;

// Resize listener reference
let resizeHandler = null;

/**
 * Initializes the cinematic scroll-driven sequence.
 * 
 * @param {Object} options Configuration parameters
 * @param {HTMLCanvasElement} options.canvas The target WebGL canvas
 * @param {HTMLElement|string} [options.scrollContainer] The element driving GSAP scroll (defaults to document.body)
 * @param {string} [options.glbUrl='/assets/models/Story2.glb'] Path to the cinematic GLB asset
 * @param {Function} [options.onProgress] Optional loading progress callback (0 - 100)
 * @param {Function} [options.onLoaded] Optional callback fired once the scene is ready and playing
 * @returns {Promise<Object>} API object containing { scene, camera, renderer, cleanup }
 */
export async function initCinematicScene({
  canvas,
  scrollContainer = document.body,
  glbUrl = '/assets/models/Story2.glb',
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
        // --------------------------------------------------------------------
        // Split animations into:
        // A) Camera scroll action -> scrubbed via cameraMixer.setTime()
        // B) Portal / Ambient actions -> looped via portalMixer.update(delta)
        const cameraClips = [];
        const ambientClips = [];

        gltf.animations.forEach((clip) => {
          const isCameraTargeted = clip.name.toLowerCase().includes('camera') ||
            clip.tracks.some(track => track.name.toLowerCase().startsWith('camera'));

          if (isCameraTargeted) {
            cameraClips.push(clip);
          } else {
            ambientClips.push(clip);
          }
        });

        // A) CAMERA MIXERS (Bound to GLTF root for track binding)
        cameraClipEntries = [];
        if (cameraClips.length > 0) {
          cameraDuration = cameraClips.reduce((max, clip) => Math.max(max, clip.duration), 0);

          cameraClips.forEach((clip) => {
            const mixer = new THREE.AnimationMixer(root);
            const action = mixer.clipAction(clip);
            action.clampWhenFinished = true;
            action.setLoop(THREE.LoopOnce);
            action.play();
            cameraClipEntries.push({ mixer, action, clip });
          });

          cameraMixer = cameraClipEntries[0]?.mixer || null;

          // Hook Camera scrub to GSAP ScrollTrigger
          setupCameraScrollTrigger(scrollContainer);
        }

        // B) PORTAL & AMBIENT MIXER (Continuous Loop for Sketchfab_model & other world elements)
        const portalNode = root.getObjectByName('Sketchfab_model') || root;
        if (ambientClips.length > 0) {
          portalMixer = new THREE.AnimationMixer(root);
          
          ambientClips.forEach((clip) => {
            const action = portalMixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            action.play();
          });
        }

        // --------------------------------------------------------------------
        // 5. TRANSPARENT PLANE SORTING & BILLBOARD FIX (Requirement 3)
        // --------------------------------------------------------------------
        billboardMeshes.length = 0;

        root.traverse((child) => {
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

            // Check for Bilboard and FOG naming prefixes
            const isBillboard = child.name.startsWith('Bilboard') || child.name.startsWith('FOG');

            if (isBillboard) {
              billboardMeshes.push(child);

              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                mat.transparent = true;
                mat.depthWrite = false; // Prevents black rectangular stripe sorting artifacts
                mat.alphaTest = 0.01;   // Discards pure black/transparent pixels
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });

              // Assign explicit render order to draw transparent planes after solid terrain
              child.renderOrder = 2;
            }

            // ----------------------------------------------------------------
            // 6. DYNAMIC STARS IDENTIFICATION (Requirement 4)
            // ----------------------------------------------------------------
            if (child.name.toLowerCase() === 'stars' || child.name.toLowerCase().includes('star')) {
              starsMesh = child;
              const starMaterials = Array.isArray(child.material) ? child.material : [child.material];
              starMaterials.forEach((mat) => {
                mat.transparent = true;
                mat.depthWrite = false;
                mat.needsUpdate = true;
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

  // 2. BILLBOARD & FOG ORIENTATION (Always face camera)
  if (camera && billboardMeshes.length > 0) {
    camera.getWorldPosition(cameraWorldPos);
    for (let i = 0; i < billboardMeshes.length; i++) {
      billboardMeshes[i].lookAt(cameraWorldPos);
    }
  }

  // 3. PROCEDURAL TWINKLING STARS
  if (starsMesh && starsMesh.material) {
    // Animate material opacity using Math.sin(Date.now() * speed) for a natural twinkling effect
    const starSpeed = 0.0035;
    const baseOpacity = 0.6;
    const amplitude = 0.38;
    const opacity = baseOpacity + Math.sin(Date.now() * starSpeed) * amplitude;

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
  billboardMeshes.length = 0;
  cameraDuration = 0;
}
