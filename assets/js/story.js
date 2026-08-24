import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Text } from 'troika-three-text';

let scene, camera, renderer;
let clock = new THREE.Clock();

let mouseX = 0, mouseY = 0;
let scrollProgress = 0.0;
let targetScrollProgress = 0.0;
let scrollVelocity = 0.0;
let lastScrollY = 0;

let cameraCurve;
let cameraGroup;

let books = [];
let portal;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE CLOUDS', timecode: 'FOLIO 01 / 05', act: 'ACT I // ROOTS' },
  { title: '01 // THE CRAFT', timecode: 'FOLIO 02 / 05', act: 'ACT I // ROOTS' },
  { title: '02 // THE SILHOUETTE', timecode: 'FOLIO 03 / 05', act: 'ACT I // ROOTS' },
  { title: '03 // THE MEMORY', timecode: 'FOLIO 04 / 05', act: 'ACT I // ROOTS' },
  { title: 'EPILOGUE // THE PORTAL', timecode: 'FOLIO 05 / 05', act: 'ACT I // ROOTS' }
];

document.addEventListener('DOMContentLoaded', async () => {
  initThree();
  buildSplinePath();
  await loadAssets();
  buildMiseEnScene();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.012);

  cameraGroup = new THREE.Group();
  scene.add(cameraGroup);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 250);
  cameraGroup.add(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  window.addEventListener('resize', onWindowResize);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  var dirLight = new THREE.DirectionalLight(0xffddaa, 1.5);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
}

// ── SPLINE PATH ──────────────────────────────────────────────
function buildSplinePath() {
  cameraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(2, 2, -10),
    new THREE.Vector3(-2, 1, -30),
    new THREE.Vector3(3, -1, -50),
    new THREE.Vector3(-2, 2, -70),
    new THREE.Vector3(0, 0, -90),
    new THREE.Vector3(0, 0, -100)
  ]);
  cameraCurve.tension = 0.5;
}

// ── LOAD GLTF ASSETS ─────────────────────────────────────────
function loadAssets() {
  var loader = new GLTFLoader();

  return new Promise(function (resolve) {
    var loadedCount = 0;
    var totalAssets = 4;

    function checkComplete() {
      loadedCount++;
      if (loadedCount >= totalAssets) resolve();
    }

    // 1. Clouds
    loader.load(
      '/assets/models/%D0%BE%D0%B1%D0%BB%D0%B0%D0%BA%D0%B0%20%D1%81%20%D1%87%D0%B5%D0%B3%D0%BE%20%D0%BD%D0%B0%D1%87%D0%B8%D0%BD%D0%B0%D0%B5%D0%BC.glb',
      function (gltf) {
        var clouds = gltf.scene;
        clouds.position.set(0, -5, -40);
        clouds.scale.setScalar(5.0);
        scene.add(clouds);
        checkComplete();
      },
      undefined,
      function () { console.warn('Failed to load clouds'); checkComplete(); }
    );

    // 2. Portal
    loader.load(
      '/assets/models/%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D0%BB2.glb',
      function (gltf) {
        portal = gltf.scene;
        portal.position.set(0, -2, -95);
        portal.scale.setScalar(2.0);
        scene.add(portal);
        checkComplete();
      },
      undefined,
      function () { console.warn('Failed to load portal'); checkComplete(); }
    );

    // 3. Book 1
    loader.load(
      '/assets/models/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0.glb',
      function (gltf) {
        for (var i = 0; i < 5; i++) {
          var b = gltf.scene.clone();
          b.position.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 10,
            -20 - Math.random() * 50
          );
          b.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          );
          b.scale.setScalar(2.0);
          b.userData = {
            rotSpeedX: (Math.random() - 0.5) * 0.02,
            rotSpeedY: (Math.random() - 0.5) * 0.02,
            baseY: b.position.y,
            floatSpeed: Math.random() * 2 + 1,
            offset: Math.random() * 10
          };
          scene.add(b);
          books.push(b);
        }
        checkComplete();
      },
      undefined,
      function () { console.warn('Failed to load book 1'); checkComplete(); }
    );

    // 4. Book 2
    loader.load(
      '/assets/models/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B02.glb',
      function (gltf) {
        for (var i = 0; i < 5; i++) {
          var b = gltf.scene.clone();
          b.position.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 10,
            -20 - Math.random() * 50
          );
          b.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          );
          b.scale.setScalar(2.0);
          b.userData = {
            rotSpeedX: (Math.random() - 0.5) * 0.02,
            rotSpeedY: (Math.random() - 0.5) * 0.02,
            baseY: b.position.y,
            floatSpeed: Math.random() * 2 + 1,
            offset: Math.random() * 10
          };
          scene.add(b);
          books.push(b);
        }
        checkComplete();
      },
      undefined,
      function () { console.warn('Failed to load book 2'); checkComplete(); }
    );
  });
}

// ── MISE EN SCÈNE ────────────────────────────────────────────
function buildMiseEnScene() {
  // Floating 3D Text
  function createFloatingText(str, pos, rotY) {
    var txt = new Text();
    txt.text = str;
    txt.fontSize = 1.5;
    txt.font = 'https://fonts.gstatic.com/s/cinzel/v19/8vIJ7qcw3PEtcqCGzCwjI7Lg_xY.woff2';
    txt.position.copy(pos);
    txt.rotation.y = rotY;
    txt.color = 0xffffff;
    txt.anchorX = 'center';
    txt.anchorY = 'middle';
    scene.add(txt);
    txt.sync();
  }

  createFloatingText('THE BEGINNING', new THREE.Vector3(5, 2, -15), -0.3);
  createFloatingText('MOMENTS DRIFT', new THREE.Vector3(-5, 1, -35), 0.3);
  createFloatingText('THE ARCHIVE', new THREE.Vector3(4, 0, -60), -0.2);

  // Photo Planes with chromatic aberration shader
  var planeGeo = new THREE.PlaneGeometry(6, 4);

  var photoVertexShader = [
    'uniform float uTime;',
    'uniform float uVelocity;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  vec3 p = position;',
    '  p.z += sin(p.y * 3.0 + uTime) * uVelocity * 0.003;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var photoFragmentShader = [
    'uniform sampler2D tMap;',
    'uniform float uVelocity;',
    'varying vec2 vUv;',
    'void main() {',
    '  float shift = uVelocity * 0.0015;',
    '  float r = texture2D(tMap, vUv + vec2(shift, 0.0)).r;',
    '  float g = texture2D(tMap, vUv).g;',
    '  float b = texture2D(tMap, vUv - vec2(shift, 0.0)).b;',
    '  gl_FragColor = vec4(r, g, b, 1.0);',
    '}'
  ].join('\n');

  function createPhotoPlane(url, pos, rot) {
    var tex = new THREE.TextureLoader().load(url);
    var mat = new THREE.ShaderMaterial({
      vertexShader: photoVertexShader,
      fragmentShader: photoFragmentShader,
      uniforms: {
        tMap: { value: tex },
        uTime: { value: 0 },
        uVelocity: { value: 0 }
      },
      transparent: true,
      side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.copy(pos);
    mesh.rotation.copy(rot);
    mesh.userData.isPhoto = true;
    mesh.userData.baseY = pos.y;
    scene.add(mesh);
  }

  createPhotoPlane('/assets/textures/unsplash_film.jpg', new THREE.Vector3(4, 3, -25), new THREE.Euler(0, -0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_silhouette.jpg', new THREE.Vector3(-4, 0, -45), new THREE.Euler(0, 0.3, 0));
  createPhotoPlane('/assets/textures/unsplash_memory.jpg', new THREE.Vector3(3, 2, -65), new THREE.Euler(0, -0.2, 0));
  createPhotoPlane('/assets/textures/unsplash_frame.jpg', new THREE.Vector3(-3, 1, -85), new THREE.Euler(0, 0.2, 0));

  // Hide DOM images
  document.querySelectorAll('.webgl-sync').forEach(function (el) { el.style.opacity = '0'; });
}

// ── GSAP SCROLL ──────────────────────────────────────────────
function initScrollTrigger() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5,
    onUpdate: function (self) {
      targetScrollProgress = self.progress;
    }
  });

  window.addEventListener('scroll', function () {
    var currentY = window.scrollY;
    scrollVelocity = currentY - lastScrollY;
    lastScrollY = currentY;
  });

  var sections = document.querySelectorAll('.story-section');
  sections.forEach(function (sec, idx) {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: function () { updateHUD(idx); },
      onEnterBack: function () { updateHUD(idx); }
    });
  });
}

function updateHUD(index) {
  var meta = sectionMeta[index] || sectionMeta[0];
  hudSceneTitle.innerText = meta.title;
  hudTimecode.innerText = meta.timecode;
  hudActLabel.innerText = meta.act;
  stepDots.forEach(function (dot, i) {
    dot.classList.toggle('active', i === index);
  });
}

// ── ANIMATION LOOP ───────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  var time = clock.getElapsedTime();

  scrollVelocity *= 0.9;
  scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;

  // Camera along spline
  if (cameraCurve) {
    var p = Math.max(0.001, Math.min(0.999, scrollProgress));
    var camPos = cameraCurve.getPointAt(p);
    cameraGroup.position.copy(camPos);

    var lookAheadP = Math.min(0.999, p + 0.03);
    var lookAtPos = cameraCurve.getPointAt(lookAheadP);
    cameraGroup.lookAt(lookAtPos);
  }

  // Mouse parallax
  var targetX = (mouseX / window.innerWidth) * 2 - 1;
  var targetY = -(mouseY / window.innerHeight) * 2 + 1;
  camera.position.x += (targetX * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.3 - camera.position.y) * 0.05;

  // Floating books
  for (var i = 0; i < books.length; i++) {
    var b = books[i];
    b.rotation.x += b.userData.rotSpeedX;
    b.rotation.y += b.userData.rotSpeedY;
    b.position.y = b.userData.baseY + Math.sin(time * b.userData.floatSpeed + b.userData.offset) * 0.5;
  }

  // Photos
  scene.traverse(function (child) {
    if (child.userData.isPhoto && child.material && child.material.uniforms) {
      child.material.uniforms.uTime.value = time;
      child.material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
        child.material.uniforms.uVelocity.value,
        scrollVelocity,
        0.1
      );
      child.position.y = child.userData.baseY + Math.sin(time + child.position.z) * 0.2;
    }
  });

  // Portal rotation
  if (portal) {
    portal.rotation.y = time * 0.1;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function initMouseListener() {
  window.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}
