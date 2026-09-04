/**
 * ============================================================================
 * DEUSFLOW · 3D CINEMATIC STORY ENGINE
 * ============================================================================
 * Architecture:
 * 1. Scene Initialization & GLTF Camera Override
 *    - Uses authored Camera from Story2.glb (Node 42).
 *    - Completely bypasses Capsule+Octree physics collision loop.
 * 2. Scrollytelling Animation Split Logic (GSAP + Three.js)
 *    - Camera Animation: Strictly scroll-driven via cameraMixer.setTime().
 *    - cameraDuration computed via Math.max across ALL camera tracks.
 *    - Portal Animation (Sketchfab_model): Continuous loop in requestAnimationFrame.
 * 3. Transparent Plane Sorting (Cloud & Fog Artifacts Fix)
 *    - All Bilboard.* and FOG.* planes set to transparent: true, depthWrite: false, alphaTest: 0.01.
 *    - Per-frame billboard orientation: mesh.lookAt(cameraWorldPos).
 * 4. Procedural Fog & Dynamic Twinkling Stars
 *    - Atmospheric THREE.Fog(0x0d0a08, 15, 200).
 *    - Sinusoidal opacity modulation on stars mesh.
 * 5. Full i18n Multilingual Support (UA / EN / DA)
 *    - Dynamic translations for HUD, timecodes, hints, and finale portal card.
 * 6. Resize Handling & Deep Memory Cleanup
 *    - camera.aspect updates & camera.updateProjectionMatrix().
 *    - Full disposal of geometries, materials, textures, and GSAP triggers.
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Timer } from 'three/addons/misc/Timer.js';

// --- i18n Dictionary Definition ---
const STORY_I18N = {
  en: {
    loading: 'Loading cinematic journey...',
    scrollHint: 'SCROLL TO EXPLORE',
    progress: 'PROGRESS //',
    navPortfolio: 'PORTFOLIO →',
    chapters: [
      { p: 0.00, act: 'ACT I // THE THRESHOLD', title: '01 // AWAKENING AT THE CANYON' },
      { p: 0.25, act: 'ACT I // THE THRESHOLD', title: '02 // GLIDING THROUGH THE FOG' },
      { p: 0.50, act: 'ACT II // CELESTIAL SHARDS', title: '03 // AMONG THE LIVING CLOUDS' },
      { p: 0.75, act: 'ACT II // CELESTIAL SHARDS', title: '04 // APPROACHING THE SINGULARITY' },
      { p: 1.00, act: 'ACT III // HORIZON GATE', title: 'EPILOGUE // THE PORTAL CORE' }
    ],
    finale: {
      badge: 'CINEMATIC ODYSSEY',
      title: 'THE PORTAL HORIZON',
      desc: 'You have traversed the celestial canyon. Ahead lie new visual worlds, heartfelt wedding stories, and creative horizons.',
      primaryBtn: 'EXPLORE PORTFOLIO',
      secondaryBtn: 'BACK TO HOME'
    }
  },
  uk: {
    loading: 'Завантаження кінематографічної сцени...',
    scrollHint: 'ГОРТАЙТЕ ДЛЯ ПОДОРОЖІ',
    progress: 'ПРОГРЕС //',
    navPortfolio: 'ПОРТФОЛІО →',
    chapters: [
      { p: 0.00, act: 'АКТ I // ПОРІГ', title: '01 // ПРОБУДЖЕННЯ НАД КАНЬЙОНОМ' },
      { p: 0.25, act: 'АКТ I // ПОРІГ', title: '02 // ПОЛІТ КРІЗЬ ТУМАН' },
      { p: 0.50, act: 'АКТ II // НЕБЕСНІ УЛАМКИ', title: '03 // СЕРЕД ЖИВИХ ХМАР' },
      { p: 0.75, act: 'АКТ II // НЕБЕСНІ УЛАМКИ', title: '04 // НАБЛИЖЕННЯ ДО СИНГУЛЯРНОСТІ' },
      { p: 1.00, act: 'АКТ III // БРАМА ГОРИЗОНТУ', title: 'ЕПІЛОГ // СЕРЦЕ ПОРТАЛУ' }
    ],
    finale: {
      badge: 'КІНЕМАТОГРАФІЧНА ОДІССЕЯ',
      title: 'ГОРИЗОНТ ПОРТАЛУ',
      desc: 'Ви пройшли крізь небесний каньйон. Попереду — сотні історій, щирі весільні кадри та нові творчі горизонти.',
      primaryBtn: 'ПЕРЕЙТИ ДО ПОРТФОЛІО',
      secondaryBtn: 'ГОЛОВНА СТОРІНКА'
    }
  },
  da: {
    loading: 'Indlæser filmisk rejse...',
    scrollHint: 'RUL FOR AT UDFORSKE',
    progress: 'FREMGANG //',
    navPortfolio: 'PORTFOLIO →',
    chapters: [
      { p: 0.00, act: 'AKT I // BEGYNDELSEN', title: '01 // OGVÅGNING VED KLØFTEN' },
      { p: 0.25, act: 'AKT I // BEGYNDELSEN', title: '02 // GLIDENDE GENNEM TÅGEN' },
      { p: 0.50, act: 'AKT II // HIMMELSKE SKÅR', title: '03 // BLANDT DE LEVENDE SKYER' },
      { p: 0.75, act: 'AKT II // HIMMELSKE SKÅR', title: '04 // NÆRMER SIG SINGULARITETEN' },
      { p: 1.00, act: 'AKT III // HORISONTENS PORT', title: 'EPILOG // PORTALENS KERNE' }
    ],
    finale: {
      badge: 'FILMISK ODYSSÉ',
      title: 'PORTALENS HORISONT',
      desc: 'Du har rejst gennem den himmelske kløft. Forude venter nye visuelle verdener, ægte bryllupshistorier og kreative horisonter.',
      primaryBtn: 'UDFORSK PORTFOLIO',
      secondaryBtn: 'TIL FORSIDEN'
    }
  }
};

function getActiveStoryLang() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang');
    if (queryLang) {
      if (queryLang === 'ua' || queryLang === 'uk') return 'uk';
      if (queryLang === 'da') return 'da';
      if (queryLang === 'en') return 'en';
    }
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/uk/') || path.startsWith('/ua/')) return 'uk';
    if (path.startsWith('/da/')) return 'da';
    const stored = localStorage.getItem('deusflow_lang');
    if (stored === 'uk' || stored === 'ua') return 'uk';
    if (stored === 'da') return 'da';
  } catch (_e) {}
  return 'en';
}

const currentLocale = getActiveStoryLang();
const i18nStrings = STORY_I18N[currentLocale] || STORY_I18N.en;

// --- Scene & Core Variables ---
let scene = null;
let camera = null;
let renderer = null;
const timer = new Timer();
let animationFrameId = null;

// --- Final 1.0 Scroll Redirect Configuration ---
let hasRedirected = false;
const FINAL_REDIRECT_URL = 'PLACEHOLDER_NEXT_PAGE_URL'; // Подставь свой целевой URL (напр. '/portfolio/' или '/#contact')

// --- Split Animation Mixers ---
let cameraMixer = null;
let portalMixer = null;
let cameraDuration = 0;
let cameraClipEntries = [];

// --- Meshes & Visual Elements ---
const billboardMeshes = [];
let starsMesh = null;
const cameraWorldPos = new THREE.Vector3();

// --- GSAP & Scroll State ---
let scrollTriggerInstance = null;
let resizeHandler = null;

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const hudPortfolioLink = document.getElementById('hud-portfolio');
const stepDots = document.querySelectorAll('.step-dot');
const scrollHint = document.getElementById('scroll-hint');
const scrollHintText = document.querySelector('#scroll-hint span');
const finaleCard = document.getElementById('portal-finale-card');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    applyInitialI18n();
    initStoryEngine();
  });
} else {
  applyInitialI18n();
  initStoryEngine();
}

function applyInitialI18n() {
  if (scrollHintText) scrollHintText.innerText = i18nStrings.scrollHint;
  if (hudPortfolioLink) hudPortfolioLink.querySelector('span').innerText = i18nStrings.navPortfolio;
  if (hudActLabel) hudActLabel.innerText = i18nStrings.chapters[0].act;
  if (hudSceneTitle) hudSceneTitle.innerText = i18nStrings.chapters[0].title;
  if (hudTimecode) hudTimecode.innerText = `${i18nStrings.progress} 0%`;

  if (finaleCard) {
    const badge = finaleCard.querySelector('.finale-badge');
    const title = finaleCard.querySelector('.finale-title');
    const desc = finaleCard.querySelector('.finale-desc');
    const primaryBtn = finaleCard.querySelector('.finale-btn.primary');
    const secondaryBtn = finaleCard.querySelector('.finale-btn.secondary');

    if (badge) badge.innerText = i18nStrings.finale.badge;
    if (title) title.innerText = i18nStrings.finale.title;
    if (desc) desc.innerText = i18nStrings.finale.desc;
    if (primaryBtn) primaryBtn.innerText = i18nStrings.finale.primaryBtn;
    if (secondaryBtn) secondaryBtn.innerText = i18nStrings.finale.secondaryBtn;
  }
}

async function initStoryEngine() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) {
    console.error('[StoryEngine] WebGL canvas not found!');
    return;
  }

  // 1. SETUP SCENE, LIGHTING & PROCEDURAL FOG (Requirement 4)
  scene = new THREE.Scene();

  // Dark amber / Hogwarts library night atmosphere
  const fogColor = new THREE.Color(0x0d0a08);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 15, 200);

  // Calibrated lighting: place_WEB and rock_WEB are unlit (MeshBasicMaterial)
  // AmbientLight provides gentle base illumination for standard portal parts
  const ambientLight = new THREE.AmbientLight(0xffedd8, 0.85);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffe2c0, 0.7);
  keyLight.position.set(-15, 35, 20);
  scene.add(keyLight);

  // 2. RENDERER SETUP
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0; // Clean 1.0 exposure to prevent blown-out baked textures
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // 3. LOAD STORY2.GLB WITH PROGRESS
  const loader = new GLTFLoader();

  loader.load(
    '/assets/models/Story2.glb',
    (gltf) => {
      const root = gltf.scene;
      scene.add(root);

      // ======================================================================
      // REQUIREMENT 1: EXTRACT GLTF CAMERA (No default camera instantiated)
      // ======================================================================
      let extractedCamera = gltf.cameras.find((c) => c.name === 'Camera');

      if (!extractedCamera) {
        root.traverse((node) => {
          if (node.isCamera && (node.name === 'Camera' || !extractedCamera)) {
            extractedCamera = node;
          }
        });
      }

      if (!extractedCamera) {
        console.warn('[StoryEngine] Camera named "Camera" not found in GLTF, using fallback.');
        extractedCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        scene.add(extractedCamera);
      }

      camera = extractedCamera;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      // ======================================================================
      // ARCHITECTURAL DIRECTIVE: CAPSULE + OCTREE COLLISION BYPASS
      // ======================================================================
      // In this cinematic scrollytelling sequence:
      // Capsule collision, Octree intersections, and physics updates are 
      // 100% BYPASSED. The camera is driven exclusively by the baked GLTF 
      // keyframes via cameraMixer.setTime().
      // ======================================================================

      // ======================================================================
      // REQUIREMENT 2: ANIMATION SPLIT LOGIC (GSAP + Three.js)
      // ======================================================================
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

      // A) Camera Mixer: Scroll-driven via GSAP ScrollTrigger
      // cameraDuration is strictly computed as Math.max across ALL camera clips
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

        initScrollInteraction();
      }

      // B) Portal & Ambient Mixer: Continuous loop for Sketchfab_model
      if (ambientClips.length > 0) {
        portalMixer = new THREE.AnimationMixer(root);

        ambientClips.forEach((clip) => {
          const action = portalMixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat);
          action.play();
        });
      }

      // ======================================================================
      // REQUIREMENT 3: TRANSPARENT PLANE SORTING & BILLBOARDS FIX
      // ======================================================================
      billboardMeshes.length = 0;

      root.traverse((child) => {
        if (child.isMesh) {
          // UNLIT FIX for Cloud_Poly and Sky: emissive=[1,1,1] in GLTF causes blowout under scene lights.
          // Convert to THREE.MeshBasicMaterial (copying map and color) to make them completely unlit.
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

          const isBillboard = child.name.startsWith('Bilboard') || child.name.startsWith('FOG');

          if (isBillboard) {
            billboardMeshes.push(child);

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              mat.transparent = true;
              mat.depthWrite = false; // Eliminates black rectangle artifacts
              mat.alphaTest = 0.01;   // Discards transparent boundary pixels
              mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;
            });

            // Draw transparent cloud/fog quads after solid geometry
            child.renderOrder = 2;
          }

          // REQUIREMENT 4: Grab Stars Mesh for Twinkling
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

      // REQUIREMENT 5: Window Resize Listener
      resizeHandler = onWindowResize;
      window.addEventListener('resize', resizeHandler);

      // Set initial frame (start of cinematic track)
      setCameraScrollProgress(0);

      // Expose debug state for verification testing
      window.__STORY_STATE__ = {
        cameraLoaded: !!camera,
        cameraName: camera ? camera.name : null,
        cameraDuration,
        cameraClipsCount: cameraClips.length,
        ambientClipsCount: ambientClips.length,
        billboardCount: billboardMeshes.length,
        hasStars: !!starsMesh,
        setScrollProgress: (progress) => {
          setCameraScrollProgress(progress);
        },
        getCameraPosition: () => camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
        getMeshMaterialInfo: (name) => {
          let found = null;
          scene?.traverse((c) => {
            if (c.name === name) {
              found = {
                name: c.name,
                materialType: c.material?.type,
                isMeshBasicMaterial: c.material?.isMeshBasicMaterial === true,
                hasMap: !!c.material?.map,
                color: c.material?.color ? c.material.color.toArray() : null
              };
            }
          });
          return found;
        }
      };

      // Hide loading screen
      hideLoadingOverlay();

      // Start render loop
      animate();
    },
    (event) => {
      if (event.total > 0) {
        const progress = Math.round((event.loaded / event.total) * 100);
        if (loadingBar) loadingBar.style.width = `${progress}%`;
        if (loadingText) loadingText.innerText = `${i18nStrings.loading} ${progress}%`;
      }
    },
    (err) => {
      console.error('[StoryEngine] Failed to load Story2.glb:', err);
      if (loadingText) loadingText.innerText = 'Error loading 3D scene';
    }
  );
}

/**
 * Scrubs camera animation clips safely based on normalized scroll progress [0, 1].
 * Clamps playback time to prevent Three.js LoopOnce overflow/reset at 100%.
 */
function setCameraScrollProgress(progress) {
  const p = Math.max(0, Math.min(1, progress));
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

/**
 * Binds camera animation scrub and HUD updates to GSAP ScrollTrigger.
 */
function initScrollInteraction() {
  if (typeof window === 'undefined' || !window.ScrollTrigger) {
    console.warn('[StoryEngine] ScrollTrigger is not available.');
    return;
  }

  const scrollWrapper = document.querySelector('.scroll-wrapper') || document.body;

  scrollTriggerInstance = window.ScrollTrigger.create({
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2, // Premium cinematic inertial scrub
    onUpdate: (self) => {
      const progress = self.progress;

      // 1. Scrub Camera Animation
      setCameraScrollProgress(progress);

      // 2. Hide Scroll Prompt on first scroll
      if (scrollHint) {
        if (progress > 0.02) {
          scrollHint.classList.add('hidden');
        } else {
          scrollHint.classList.remove('hidden');
        }
      }

      // 3. Update HUD Chapter & Timecode
      updateHUD(progress);

      // 4. Reveal Finale Portal Card at the end of track
      if (finaleCard) {
        if (progress > 0.94) {
          finaleCard.classList.add('visible');
        } else {
          finaleCard.classList.remove('visible');
        }
      }

      // 5. Final Idempotent Redirect at 100% Scroll
      if (progress >= 0.999 && !hasRedirected) {
        hasRedirected = true;
        const fadeOverlay = document.getElementById('fade-overlay');
        if (fadeOverlay) {
          fadeOverlay.classList.add('active');
        }
        setTimeout(() => {
          window.location.href = FINAL_REDIRECT_URL;
        }, 800);
      }
    }
  });

  // Allow clicking on stepper dots to smoothly scroll to corresponding milestone
  stepDots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      const targetP = i18nStrings.chapters[index] ? i18nStrings.chapters[index].p : index / (stepDots.length - 1);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: targetP * maxScroll,
        behavior: 'smooth'
      });
    });
  });
}

/**
 * Updates HUD chapter name, progress percentage, and step indicator dots.
 */
function updateHUD(progress) {
  const chaptersList = i18nStrings.chapters;
  let currentChapter = chaptersList[0];
  let currentIdx = 0;
  for (let i = chaptersList.length - 1; i >= 0; i--) {
    if (progress >= chaptersList[i].p - 0.05) {
      currentChapter = chaptersList[i];
      currentIdx = i;
      break;
    }
  }

  const pct = Math.round(progress * 100);

  if (hudSceneTitle) hudSceneTitle.innerText = currentChapter.title;
  if (hudActLabel) hudActLabel.innerText = currentChapter.act;
  if (hudTimecode) hudTimecode.innerText = `${i18nStrings.progress} ${pct}%`;

  stepDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentIdx);
  });
}

/**
 * Smoothly hides the initial loading screen.
 */
function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('fade-out');
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 850);
  }
}

/**
 * Main Render & Animation Loop (60/120 FPS).
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  // Requirement 4: Timer protects portalMixer against delta spikes when tab is hidden
  timer.update();
  const delta = timer.getDelta();

  // ==========================================================================
  // [COLLISION BYPASS]: Physics / Capsule+Octree are completely omitted here.
  // The camera follows the baked GLTF trajectory without obstacle conflicts.
  // ==========================================================================

  // 1. Ambient Portal Animation (Loops continuously regardless of scroll pause)
  if (portalMixer) {
    portalMixer.update(delta);
  }

  // 2. Orient all Bilboard and FOG planes towards the camera
  if (camera && billboardMeshes.length > 0) {
    camera.getWorldPosition(cameraWorldPos);
    for (let i = 0; i < billboardMeshes.length; i++) {
      billboardMeshes[i].lookAt(cameraWorldPos);
    }
  }

  // 3. Dynamic Stars Twinkle using Math.sin(Date.now() * speed)
  if (starsMesh && starsMesh.material) {
    const starSpeed = 0.0035;
    const opacity = 0.58 + Math.sin(Date.now() * starSpeed) * 0.38;

    if (Array.isArray(starsMesh.material)) {
      starsMesh.material.forEach((mat) => { mat.opacity = opacity; });
    } else {
      starsMesh.material.opacity = opacity;
    }
  }

  // 4. Render Scene with extracted GLTF Camera
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Responsive Window Resize Handler.
 */
function onWindowResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

/**
 * Deep Cleanup & Unmount function to prevent SPA memory leaks.
 */
export function cleanup() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
    scrollTriggerInstance = null;
  }

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

  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach((mat) => {
          for (const key of Object.keys(mat)) {
            const val = mat[key];
            if (val && typeof val === 'object' && 'dispose' in val && typeof val.dispose === 'function') {
              val.dispose();
            }
          }
          mat.dispose();
        });
      }
    });

    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    scene = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  camera = null;
  clock = null;
  starsMesh = null;
  billboardMeshes.length = 0;
  cameraDuration = 0;
}
