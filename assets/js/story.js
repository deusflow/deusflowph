import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

let scene, camera, renderer;
let clock = new THREE.Clock();

let mouseX = 0, mouseY = 0;
let scrollProgress = 0.0;
let targetScrollProgress = 0.0;
let scrollVelocity = 0.0;
let lastScrollY = 0;

let cameraCurve;

let cloudsContainer;
let portalMesh;
let floatingBooks = [];
let textPlanes = [];

// Procedural Volumetric Cloud Canyon System
let cloudVolumeMesh;
let cloudVolumeMaterial;

// Physics / Capsule Collision System
let worldOctree;
let playerCapsule;
let collisionGroup;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE INNER SANCTUM', timecode: 'FOLIO 01 / 05', act: 'ACT I // ROOTS' },
  { title: '01 // CHILDHOOD & CRAFT', timecode: 'FOLIO 02 / 05', act: 'ACT I // ROOTS' },
  { title: '02 // THE FIRST 35MM LENS', timecode: 'FOLIO 03 / 05', act: 'ACT I // ROOTS' },
  { title: '03 // THE DIGITAL DAWN', timecode: 'FOLIO 04 / 05', act: 'ACT I // ROOTS' },
  { title: 'EPILOGUE // THE PORTAL', timecode: 'FOLIO 05 / 05', act: 'ACT I // ROOTS' }
];

document.addEventListener('DOMContentLoaded', () => {
  document.fonts.ready.then(() => {
    initThree();
    initCollisionSystem();
    buildSplinePath();
    loadAssets();
    initProceduralCloudCanyon();
    build3DStoryTypography();
    initScrollTrigger();
    initMouseListener();
    animate();
  });
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 250);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  window.addEventListener('resize', onWindowResize);
}

// ── PROCEDURAL VOLUMETRIC CLOUD CANYON SHADER ────────────────
function initProceduralCloudCanyon() {
  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vCamPos;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vCamPos = cameraPosition;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    varying vec3 vWorldPosition;
    varying vec3 vCamPos;

    // Fast 3D Simplex noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    float fbm(vec3 p) {
      float f = 0.0;
      f += 0.5000 * snoise(p); p *= 2.02;
      f += 0.2500 * snoise(p); p *= 2.03;
      f += 0.1250 * snoise(p);
      return f;
    }

    void main() {
      vec3 ro = vCamPos;
      vec3 rd = normalize(vWorldPosition - vCamPos);

      float tMin = 0.2;
      float tMax = 70.0;
      int steps = 32;
      float stepSize = (tMax - tMin) / float(steps);

      vec3 accColor = vec3(0.0);
      float transmittance = 1.0;

      vec3 sunDir = normalize(vec3(0.05, 0.35, -1.0));
      vec3 cloudShadow = vec3(0.24, 0.20, 0.32);
      vec3 cloudSun = vec3(0.98, 0.90, 0.82);
      vec3 cloudWarm = vec3(0.95, 0.72, 0.60);

      for (int i = 0; i < 32; i++) {
        float t = tMin + float(i) * stepSize;
        vec3 p = ro + rd * t;

        // Canyon Corridor: 100% CLEAR AIR in central flight tunnel
        float spineX = sin(p.z * 0.05) * 1.5;
        float spineY = 1.4 + sin(p.z * 0.03) * 0.3;
        float distToSpine = length(vec2(p.x - spineX, (p.y - spineY) * 1.4));

        // Hollow tunnel (dist < 5.0 is completely clear, clouds only form on canyon walls & floor)
        float canyonMask = smoothstep(4.8, 8.5, distToSpine);

        if (canyonMask > 0.01) {
          vec3 samplePos = p * 0.07 + vec3(0.0, uTime * 0.008, 0.0);
          float n = fbm(samplePos);
          
          float floorBias = clamp((-0.5 - p.y) * 0.18, 0.0, 0.75);
          float density = max(0.0, n + 0.12 + floorBias) * canyonMask * 0.55;

          if (density > 0.008) {
            float sunDot = max(0.0, dot(rd, sunDir));
            float phase = 0.5 + 0.5 * pow(sunDot, 2.5);
            vec3 col = mix(cloudShadow, mix(cloudWarm, cloudSun, phase), phase);

            float att = exp(-density * stepSize * 0.5);
            accColor += col * (1.0 - att) * transmittance;
            transmittance *= att;

            if (transmittance < 0.03) break;
          }
        }
      }

      float alpha = 1.0 - transmittance;
      gl_FragColor = vec4(accColor, alpha);
    }
  `;

  cloudVolumeMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
      uTime: { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide
  });

  const geo = new THREE.BoxGeometry(65, 30, 130);
  cloudVolumeMesh = new THREE.Mesh(geo, cloudVolumeMaterial);
  cloudVolumeMesh.position.set(0, 0, -35);
  cloudVolumeMesh.renderOrder = 2;
  scene.add(cloudVolumeMesh);
}

// ── COLLISION & CAPSULE SYSTEM ────────────────────────────────
function initCollisionSystem() {
  worldOctree = new Octree();
  
  playerCapsule = new Capsule(
    new THREE.Vector3(0, -0.4, 0),
    new THREE.Vector3(0, 0.4, 0),
    0.35
  );

  collisionGroup = new THREE.Group();
  collisionGroup.visible = false;

  const floorGeo = new THREE.PlaneGeometry(60, 140);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial());
  floorMesh.position.set(0, -14, -40);
  collisionGroup.add(floorMesh);

  const ceilGeo = new THREE.PlaneGeometry(60, 140);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMesh = new THREE.Mesh(ceilGeo, new THREE.MeshBasicMaterial());
  ceilMesh.position.set(0, 14, -40);
  collisionGroup.add(ceilMesh);

  const wallLeftGeo = new THREE.PlaneGeometry(140, 30);
  wallLeftGeo.rotateY(Math.PI / 2);
  const wallLeft = new THREE.Mesh(wallLeftGeo, new THREE.MeshBasicMaterial());
  wallLeft.position.set(-25.0, 0, -40);
  collisionGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(wallLeftGeo.clone(), new THREE.MeshBasicMaterial());
  wallRight.position.set(25.0, 0, -40);
  collisionGroup.add(wallRight);

  scene.add(collisionGroup);
  worldOctree.fromGraphNode(collisionGroup);
}

// ── NATURAL CRUISE ALTITUDE CAMERA FLYTHROUGH PATH ────────────
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.6, 9),       // Beat 0: Hero view of Ship and glowing cloud arch
    new THREE.Vector3(1.2, 1.4, -12),   // Beat 1: Soaring above the cloud entrance
    new THREE.Vector3(-1.2, 1.3, -34),  // Beat 2: Cruising above the cloud sea
    new THREE.Vector3(1.0, 1.2, -54),   // Beat 3: Gliding towards the clearing
    new THREE.Vector3(-0.2, 1.1, -70),  // Beat 4: Approaching the magical Portal
    new THREE.Vector3(0, 1.0, -80)      // Beat 5: Stepping into the Portal
  ]);
  cameraCurve.tension = 0.5;

  const startPos = cameraCurve.getPointAt(0.001);
  const lookPos = cameraCurve.getPointAt(0.04);
  camera.position.copy(startPos);
  camera.lookAt(lookPos);
}

// ── LOAD 3D ASSETS (Preserving Ship, Sky & Portal; Replacing Jagged Diorama) ──
function loadAssets() {
  const loader = new GLTFLoader();

  // 1. Original Ship & Sky Dome
  loader.load(
    '/assets/models/%D0%BE%D0%B1%D0%BB%D0%B0%D0%BA%D0%B0%20%D1%81%20%D1%87%D0%B5%D0%B3%D0%BE%20%D0%BD%D0%B0%D1%87%D0%B8%D0%BD%D0%B0%D0%B5%D0%BC.glb',
    (gltf) => {
      const model = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      model.position.sub(center);

      cloudsContainer = new THREE.Group();
      cloudsContainer.add(model);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 140 / (maxDim || 1);
      cloudsContainer.scale.setScalar(scale);
      
      cloudsContainer.rotation.y = 0;
      cloudsContainer.position.set(0, 0, -35);

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.frustumCulled = false;
          
          if (child.name && child.name.includes('Sky')) {
            // Sky Dome: solid background hemisphere
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = false;
            child.renderOrder = 0;
          } else if (child.name && child.name.includes('Boot')) {
            // Ship: solid beautiful flying boat
            child.material.side = THREE.DoubleSide;
            child.material.depthWrite = true;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.7;
            if ('metalness' in child.material) child.material.metalness = 0.0;
            child.renderOrder = 1;
          } else {
            // Replace the jagged diorama polygon floor with procedural volumetric cloud volume
            child.visible = false;
          }

          // Zero out specular/Fresnel on ship and sky
          child.material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <lights_fragment_end>',
              `
              reflectedLight.directSpecular = vec3( 0.0 );
              reflectedLight.indirectSpecular = vec3( 0.0 );
              #include <lights_fragment_end>
              `
            );
          };
        }
      });

      scene.add(cloudsContainer);
    },
    undefined,
    (err) => { console.warn('4K Clouds model note:', err); }
  );

  // 2. Destination Portal at Z = -84
  loader.load(
    '/assets/models/%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D0%BB2.glb',
    (gltf) => {
      portalMesh = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(portalMesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      portalMesh.position.sub(center);

      const portalContainer = new THREE.Group();
      portalContainer.add(portalMesh);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      portalContainer.scale.setScalar(9.0 / (maxDim || 1));
      portalContainer.position.set(0, 0, -84);

      portalMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.side = THREE.DoubleSide;
        }
      });

      scene.add(portalContainer);
    },
    undefined,
    (err) => { console.warn('Portal model note:', err); }
  );
}

// ── 3D HANDWRITTEN STORY TYPOGRAPHY ──────────────────────────
function createHandwritten3DText(badge, title, subtitle, pos, rotY = 0, sectionIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 512);

  // 1. Badge / Small Caps Header
  if (badge) {
    ctx.font = '600 22px "Space Mono", monospace';
    ctx.fillStyle = '#d8b888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fillText(badge.toUpperCase(), 512, 90);
  }

  // 2. Main Title (Handwritten Script)
  ctx.font = '700 58px "Caveat", "Marck Script", cursive';
  ctx.fillStyle = '#fff4dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(216, 184, 136, 0.95)';
  ctx.shadowBlur = 24;
  ctx.fillText(title, 512, 140);

  // 3. Subtitle / Story Line (Poetic Handwritten Script)
  if (subtitle) {
    ctx.font = '500 32px "Caveat", "Marck Script", cursive';
    ctx.fillStyle = '#e8dcc0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;
    
    const words = subtitle.split(' ');
    let line = '';
    let y = 230;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 860 && n > 0) {
        ctx.fillText(line, 512, y);
        line = words[n] + ' ';
        y += 44;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 512, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.02,
    opacity: sectionIndex === 0 ? 1.0 : 0.0
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 4.25), mat);
  plane.position.copy(pos);
  plane.rotation.y = rotY;
  plane.userData = {
    baseY: pos.y,
    sectionIndex: sectionIndex
  };
  plane.renderOrder = 4;
  scene.add(plane);
  textPlanes.push(plane);
  return plane;
}

function build3DStoryTypography() {
  createHandwritten3DText(
    'DEUSFLOW ARCHIVES · FOLIO 00',
    'Олег Ро',
    'Ніч у чарівній бібліотеці: історія про те, як дитяча допитливість перетворюється на ремесло.',
    new THREE.Vector3(0, 1.8, 1),
    0,
    0
  );

  createHandwritten3DText(
    '01 // CRAFT & EMBROIDERY',
    'Дитяча Допитливість',
    'Усе життя я любив малювати й перемальовувати картинки на свій лад. Праця, вишивка та перші кроки у світ форми.',
    new THREE.Vector3(3.0, 1.4, -16),
    -0.18,
    1
  );

  createHandwritten3DText(
    '02 // THE FIRST LENS · 35MM',
    'Олімпус та Крим',
    'Бабуся подарувала мені плівкову камеру. Перші невпевнені кадри, море, Крим та зародження любові до світла.',
    new THREE.Vector3(-3.2, 1.3, -36),
    0.15,
    2
  );

  createHandwritten3DText(
    '03 // DIGITAL DAWN · CANON EOS',
    'Пошук Власного Почерку',
    'Через пару років з’явився Canon 1000D. Сотні туторіалів, ночі за фотошопом та візуальна поезія.',
    new THREE.Vector3(2.6, 1.2, -54),
    -0.12,
    3
  );

  createHandwritten3DText(
    'EPILOGUE // THE PORTAL',
    'Заклинання Миті',
    'Кожен кадр — це заклинання, що затримує мить, яка більше ніколи не повториться.',
    new THREE.Vector3(0, 1.1, -72),
    0,
    4
  );
}

// ── GSAP SMOOTH SCROLL INTEGRATION ───────────────────────────
function initScrollTrigger() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
      const idx = Math.min(sectionMeta.length - 1, Math.floor(self.progress * sectionMeta.length));
      updateHUD(idx);
    }
  });

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    scrollVelocity = currentY - lastScrollY;
    lastScrollY = currentY;
  });
}

function updateHUD(index) {
  const meta = sectionMeta[index] || sectionMeta[0];
  if (hudSceneTitle) hudSceneTitle.innerText = meta.title;
  if (hudTimecode) hudTimecode.innerText = meta.timecode;
  if (hudActLabel) hudActLabel.innerText = meta.act;
  stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// ── RENDER & ANIMATION LOOP ──────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  scrollVelocity *= 0.9;
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.06;

  // Update Procedural Clouds uniform
  if (cloudVolumeMaterial) {
    cloudVolumeMaterial.uniforms.uTime.value = time;
  }

  if (cameraCurve) {
    const p = Math.max(0.001, Math.min(0.999, scrollProgress));
    const camPos = cameraCurve.getPointAt(p);
    
    const targetX = (mouseX / window.innerWidth) * 2 - 1;
    const targetY = -(mouseY / window.innerHeight) * 2 + 1;
    
    const desiredPos = new THREE.Vector3(
      camPos.x + targetX * 0.35,
      camPos.y + targetY * 0.25,
      camPos.z
    );

    playerCapsule.start.set(desiredPos.x, desiredPos.y - 0.4, desiredPos.z);
    playerCapsule.end.set(desiredPos.x, desiredPos.y + 0.4, desiredPos.z);

    if (worldOctree) {
      const hit = worldOctree.capsuleIntersect(playerCapsule);
      if (hit) {
        playerCapsule.translate(hit.normal.multiplyScalar(hit.depth));
      }
    }

    camera.position.set(
      (playerCapsule.start.x + playerCapsule.end.x) * 0.5,
      (playerCapsule.start.y + playerCapsule.end.y) * 0.5,
      playerCapsule.start.z
    );

    const lookAheadP = Math.min(0.999, p + 0.04);
    const lookAtPos = cameraCurve.getPointAt(lookAheadP);
    camera.lookAt(lookAtPos);
  }

  // Fade text planes in and out per chapter (no overlapping clutter)
  for (let i = 0; i < textPlanes.length; i++) {
    const p = textPlanes[i];
    const targetProgress = p.userData.sectionIndex / (textPlanes.length - 1);
    const diff = Math.abs(scrollProgress - targetProgress);
    const alpha = Math.max(0.0, Math.min(1.0, 1.0 - (diff / 0.16)));
    
    p.material.opacity = alpha;
    p.visible = alpha > 0.02;
    p.position.y = p.userData.baseY + Math.sin(time * 0.8 + p.position.z * 0.1) * 0.08;
  }

  if (portalMesh) {
    portalMesh.rotation.y = time * 0.12;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function initMouseListener() {
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}
