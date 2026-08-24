import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const SHARD_COUNT = 450;
const DUST_COUNT = 70;
const EMBER_COUNT = 20;

let scene, camera, renderer;
let clock = new THREE.Clock();

let shardsMesh, shardsMaterial, shardsGeometry;
let dustMesh, dustMaterial, dustGeometry;
let emberMesh, emberMaterial, emberGeometry;

let mouseX = 0, mouseY = 0;
let scrollVelocity = 0.0;
let lastScrollY = 0;
let currentActiveSection = 0;
let targetMorphProgress = 0.0;
let currentMorphProgress = 0.0;

// Shard Targets (0 = Text, 1 = Camera)
const targetPos0 = new Float32Array(SHARD_COUNT * 3);
const targetPos1 = new Float32Array(SHARD_COUNT * 3);

// Shard Physics Arrays
const instPos = new Float32Array(SHARD_COUNT * 3);
const instVel = new Float32Array(SHARD_COUNT * 3);
const instRot = new Float32Array(SHARD_COUNT * 3);
const instRotSpeed = new Float32Array(SHARD_COUNT * 3);
const instScale = new Float32Array(SHARD_COUNT * 2);
const instType = new Float32Array(SHARD_COUNT);

let attrInstancePos, attrInstanceRot, attrInstanceScale;

// DOM Elements
const hudSceneTitle = document.getElementById('hud-scene-title');
const hudTimecode = document.getElementById('hud-timecode');
const hudActLabel = document.getElementById('hud-act-label');
const stepDots = document.querySelectorAll('.step-dot');

const sectionMeta = [
  { title: 'PROLOGUE // THE THRESHOLD', timecode: 'FOLIO 01 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'FOLIO 01 // THE INITIATION', timecode: 'FOLIO 02 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '01 // CRAFT & EMBROIDERY', timecode: 'FOLIO 03 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '02 // THE FIRST LENS · 35MM', timecode: 'FOLIO 04 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: '03 // CANON 1000D · DIGITAL', timecode: 'FOLIO 05 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' },
  { title: 'EPILOGUE // THE STILLNESS', timecode: 'FOLIO 06 / 06', act: 'ACT I // ROOTS & THE FIRST LENS' }
];

// DOM-Synced Planes
const imagePlanes = [];
const planeGeometry = new THREE.PlaneGeometry(1, 1, 32, 32); // more segments for wave distortion
const planeMaterialTemplate = new THREE.ShaderMaterial({
  vertexShader: `
    uniform float uTime;
    uniform float uVelocity;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 p = position;
      // Wave distortion based on velocity
      p.z += sin(p.y * 10.0 + uTime * 2.0) * uVelocity * 0.05;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tMap;
    uniform float uVelocity;
    varying vec2 vUv;
    void main() {
      // RGB Shift based on velocity
      float shift = uVelocity * 0.015;
      float r = texture2D(tMap, vUv + vec2(shift, 0.0)).r;
      float g = texture2D(tMap, vUv).g;
      float b = texture2D(tMap, vUv - vec2(shift, 0.0)).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
  uniforms: {
    tMap: { value: null },
    uTime: { value: 0.0 },
    uVelocity: { value: 0.0 }
  },
  transparent: true
});

document.addEventListener('DOMContentLoaded', async () => {
  initThree();
  buildDustMotes();
  buildEmbers();
  await buildTargetsAndShards();
  setupDOMSyncedPlanes();
  initScrollTrigger();
  initMouseListener();
  animate();
});

function initThree() {
  const canvas = document.getElementById('webgl-canvas');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8.0);
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  window.addEventListener('resize', onWindowResize);
}

// --------------------------------------------------------------------------
// TARGET SAMPLING (TEXT & CAMERA)
// --------------------------------------------------------------------------
function sampleTextToPoints(lines, count, bounds) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1600;
  canvas.height = 800;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = 140;
  ctx.font = \`bold \${fontSize}px "Cinzel", serif\`;
  
  const lineHeight = fontSize * 1.25;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const validPixels = [];
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      if (imgData[(y * canvas.width + x) * 4] > 100) {
        validPixels.push({
          x: (x / canvas.width - 0.5) * bounds.width + bounds.x,
          y: (-(y / canvas.height - 0.5)) * bounds.height + bounds.y
        });
      }
    }
  }

  const points = new Float32Array(count * 3);
  const totalValid = validPixels.length || 1;
  for (let i = 0; i < count; i++) {
    const p = validPixels[i % totalValid] || { x: 0, y: 0 };
    points[i * 3 + 0] = p.x + (Math.random() - 0.5) * 0.05;
    points[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.05;
    points[i * 3 + 2] = bounds.z + (Math.random() - 0.5) * 0.1;
  }
  return points;
}

async function sampleGLTFModel(gltfPath, count, bounds) {
  return new Promise((resolve) => {
    new GLTFLoader().load(gltfPath, (gltf) => {
      const meshes = [];
      gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) meshes.push(child);
      });
      const points = new Float32Array(count * 3);
      if (meshes.length > 0) {
        const sampler = new MeshSurfaceSampler(meshes[0]).build();
        const _p = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          sampler.sample(_p);
          points[i * 3 + 0] = _p.x * 2.5 + bounds.x;
          points[i * 3 + 1] = _p.y * 2.5 + bounds.y - 0.5;
          points[i * 3 + 2] = _p.z * 2.5 + bounds.z;
        }
      }
      resolve(points);
    });
  });
}

async function buildTargetsAndShards() {
  // 1. Generate Targets
  const t0 = sampleTextToPoints(['ОЛЕГ РО', 'ARCHIVE'], SHARD_COUNT, {x:0, y:0.5, z:0, width:6, height:3});
  targetPos0.set(t0);
  
  const t1 = await sampleGLTFModel('/assets/models/vintage_camera.glb', SHARD_COUNT, {x:0, y:0, z:0});
  targetPos1.set(t1);

  // 2. Build Physical Shard Geometry
  const baseGeo = new THREE.PlaneGeometry(0.12, 0.12, 2, 2);
  const pos = baseGeo.attributes.position;
  for (let i=0; i<pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random()-0.5)*0.03);
    pos.setY(i, pos.getY(i) + (Math.random()-0.5)*0.03);
    pos.setZ(i, (Math.random()-0.5)*0.02);
  }
  baseGeo.computeVertexNormals();
  
  shardsGeometry = new THREE.InstancedBufferGeometry();
  shardsGeometry.copy(baseGeo);
  shardsGeometry.instanceCount = SHARD_COUNT;

  // Initialize instances at Target 0
  for(let i=0; i<SHARD_COUNT; i++) {
    instPos[i*3+0] = targetPos0[i*3+0];
    instPos[i*3+1] = targetPos0[i*3+1];
    instPos[i*3+2] = targetPos0[i*3+2];
    
    instRot[i*3+0] = Math.random() * Math.PI * 2;
    instRot[i*3+1] = Math.random() * Math.PI * 2;
    instRot[i*3+2] = Math.random() * Math.PI * 2;
    
    instRotSpeed[i*3+0] = (Math.random()-0.5) * 0.05;
    instRotSpeed[i*3+1] = (Math.random()-0.5) * 0.05;
    instRotSpeed[i*3+2] = (Math.random()-0.5) * 0.05;
    
    instScale[i*2+0] = 0.5 + Math.random()*0.8;
    instScale[i*2+1] = 0.5 + Math.random()*0.8;
    
    instType[i] = Math.random() > 0.3 ? 0.0 : (Math.random() > 0.5 ? 1.0 : 2.0);
  }

  attrInstancePos = new THREE.InstancedBufferAttribute(instPos, 3);
  attrInstanceRot = new THREE.InstancedBufferAttribute(instRot, 3);
  attrInstanceScale = new THREE.InstancedBufferAttribute(instScale, 2);
  
  shardsGeometry.setAttribute('aInstancePos', attrInstancePos);
  shardsGeometry.setAttribute('aInstanceRot', attrInstanceRot);
  shardsGeometry.setAttribute('aInstanceScale', attrInstanceScale);
  shardsGeometry.setAttribute('aTargetPos0', new THREE.InstancedBufferAttribute(targetPos0, 3));
  shardsGeometry.setAttribute('aTargetPos1', new THREE.InstancedBufferAttribute(targetPos1, 3));
  shardsGeometry.setAttribute('aType', new THREE.InstancedBufferAttribute(instType, 1));

  shardsMaterial = new THREE.ShaderMaterial({
    vertexShader: \`
      uniform float uTime;
      uniform float uMorphProgress;
      uniform vec2 uMouse;
      
      attribute vec3 aInstancePos;
      attribute vec3 aInstanceRot;
      attribute vec2 aInstanceScale;
      attribute vec3 aTargetPos0;
      attribute vec3 aTargetPos1;
      attribute float aType;
      
      varying vec2 vUv;
      varying float vType;
      varying float vGlow;
      
      mat4 rotationMatrix(vec3 axis, float angle) {
        axis = normalize(axis);
        float s = sin(angle), c = cos(angle), oc = 1.0 - c;
        return mat4(
          oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
          oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
          oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
          0.0,                                0.0,                                0.0,                                1.0
        );
      }
      
      void main() {
        vUv = uv;
        vType = aType;
        
        // Morphing
        vec3 morphedPos = mix(aTargetPos0, aTargetPos1, uMorphProgress);
        
        // Add breathing motion
        morphedPos.x += sin(uTime * 0.5 + morphedPos.y * 2.0) * 0.05;
        morphedPos.y += cos(uTime * 0.4 + morphedPos.x * 2.0) * 0.05;
        
        // Add slight drift based on instance position (already updated in CPU for rotation)
        vec3 pos = aInstancePos; // We will actually use CPU to update aInstancePos towards morphedPos for fluid delay
        
        // Actually let's do the morph interpolation purely on CPU so they trail beautifully,
        // so aInstancePos is the CURRENT position.
        
        mat4 rotX = rotationMatrix(vec3(1,0,0), aInstanceRot.x);
        mat4 rotY = rotationMatrix(vec3(0,1,0), aInstanceRot.y);
        mat4 rotZ = rotationMatrix(vec3(0,0,1), aInstanceRot.z);
        mat4 finalRot = rotZ * rotY * rotX;
        
        vec3 scaledObj = position * vec3(aInstanceScale.x, aInstanceScale.y, 1.0);
        vec3 rotatedObj = (finalRot * vec4(scaledObj, 1.0)).xyz;
        
        vec3 finalPos = rotatedObj + aInstancePos;
        
        // Mouse avoidance
        float dist = length(finalPos.xy - uMouse);
        if(dist < 1.5) {
          float force = (1.5 - dist) / 1.5;
          finalPos.xy += normalize(finalPos.xy - uMouse) * force * 0.2;
          vGlow = force;
        } else {
          vGlow = 0.0;
        }
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
      }
    \`,
    fragmentShader: \`
      varying vec2 vUv;
      varying float vType;
      varying float vGlow;
      
      void main() {
        vec3 color = vec3(0.91, 0.86, 0.75); // Parchment
        if (vType > 0.5 && vType < 1.5) color = vec3(0.1, 0.12, 0.18); // Ink
        if (vType > 1.5) color = vec3(0.85, 0.70, 0.45); // Gold
        
        // Edges
        float edge = 1.0 - max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
        float alpha = smoothstep(0.0, 0.2, edge);
        
        // Gold glowing edges
        if (vType > 1.5 && edge < 0.3) {
           color = mix(color, vec3(1.0, 0.9, 0.6), 1.0 - (edge/0.3));
        }
        
        color += vec3(0.9, 0.7, 0.3) * vGlow * 0.5;
        
        gl_FragColor = vec4(color, alpha);
        if(alpha < 0.1) discard;
      }
    \`,
    uniforms: {
      uTime: { value: 0.0 },
      uMorphProgress: { value: 0.0 },
      uMouse: { value: new THREE.Vector2(0,0) }
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false
  });

  shardsMesh = new THREE.Mesh(shardsGeometry, shardsMaterial);
  // Mesh -> InstancedMesh is not strictly needed if we use InstancedBufferGeometry and Mesh
  // But wait, it's safer to just use Mesh with InstancedBufferGeometry as we wrote the shader for it.
  scene.add(shardsMesh);
}

// --------------------------------------------------------------------------
// DOM-SYNCED WEBGL PLANES
// --------------------------------------------------------------------------
function setupDOMSyncedPlanes() {
  const domImages = document.querySelectorAll('.webgl-sync');
  domImages.forEach((img) => {
    // Hide original image
    img.style.opacity = '0';
    
    // Create texture and mesh
    const texture = new THREE.TextureLoader().load(img.src);
    const material = planeMaterialTemplate.clone();
    material.uniforms.tMap.value = texture;
    
    const mesh = new THREE.Mesh(planeGeometry, material);
    scene.add(mesh);
    
    imagePlanes.push({ domEl: img, mesh: mesh });
  });
}

function updateDOMSyncedPlanes() {
  imagePlanes.forEach((item) => {
    const rect = item.domEl.getBoundingClientRect();
    
    // Check if visible
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      item.mesh.visible = false;
      return;
    }
    item.mesh.visible = true;
    
    // Map DOM coordinates to WebGL coordinates
    // Convert top-left to center-based coordinates
    const x = (rect.left + rect.width / 2) - window.innerWidth / 2;
    const y = -(rect.top + rect.height / 2) + window.innerHeight / 2;
    
    // WebGL view width/height at Z=0
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const heightAtZ0 = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const widthAtZ0 = heightAtZ0 * camera.aspect;
    
    const scaleX = rect.width / window.innerWidth * widthAtZ0;
    const scaleY = rect.height / window.innerHeight * heightAtZ0;
    
    const glX = (x / window.innerWidth) * widthAtZ0;
    const glY = (y / window.innerHeight) * heightAtZ0;
    
    item.mesh.position.set(glX, glY, 0);
    item.mesh.scale.set(scaleX, scaleY, 1);
    
    // Update velocity uniform for distortion
    item.mesh.material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
      item.mesh.material.uniforms.uVelocity.value,
      scrollVelocity,
      0.1
    );
  });
}

// --------------------------------------------------------------------------
// DUST & EMBERS (Atmosphere)
// --------------------------------------------------------------------------
function buildDustMotes() {
  dustGeometry = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3 + 0] = (Math.random() - 0.5) * 8.0 - 1.5;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 6.0 + 1.0;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4.0;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustMaterial = new THREE.ShaderMaterial({
    vertexShader: \`
      uniform float uTime;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.4 + position.y * 2.0) * 0.15;
        p.y += cos(uTime * 0.3 + position.x * 2.0) * 0.15;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (18.0 / -mvPosition.z);
      }
    \`,
    fragmentShader: \`
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(0.96, 0.88, 0.74, core * 0.3);
      }
    \`,
    uniforms: { uTime: { value: 0.0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  dustMesh = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dustMesh);
}

function buildEmbers() {
  emberGeometry = new THREE.BufferGeometry();
  const pos = new Float32Array(EMBER_COUNT * 3);
  for(let i=0; i<EMBER_COUNT; i++) {
    pos[i*3] = (Math.random()-0.5)*10;
    pos[i*3+1] = -5 - Math.random()*5;
    pos[i*3+2] = (Math.random()-0.5)*2;
  }
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  emberMaterial = new THREE.ShaderMaterial({
    vertexShader: \`
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += mod(uTime * 1.5 + p.x, 15.0);
        p.x += sin(uTime * 2.0 + p.y) * 0.5;
        vAlpha = sin(uTime * 3.0 + p.x) * 0.5 + 0.5;
        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = (15.0 / -mvPos.z);
      }
    \`,
    fragmentShader: \`
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if(d>0.5) discard;
        gl_FragColor = vec4(1.0, 0.6, 0.2, (1.0-d*2.0)*vAlpha);
      }
    \`,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  emberMesh = new THREE.Points(emberGeometry, emberMaterial);
  scene.add(emberMesh);
}

// --------------------------------------------------------------------------
// GSAP SCROLL & LOGIC
// --------------------------------------------------------------------------
function initScrollTrigger() {
  const sections = document.querySelectorAll('.story-section');
  sections.forEach((sec, idx) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => updateHUD(idx),
      onEnterBack: () => updateHUD(idx)
    });
  });

  // Morph Trigger
  ScrollTrigger.create({
    trigger: '#section-1', // Where Camera appears
    start: 'top bottom',
    end: 'center center',
    scrub: true,
    onUpdate: (self) => {
      targetMorphProgress = self.progress;
    }
  });

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    scrollVelocity = (currentY - lastScrollY);
    lastScrollY = currentY;
  });
}

function updateHUD(index) {
  currentActiveSection = index;
  const meta = sectionMeta[index] || sectionMeta[0];
  hudSceneTitle.innerText = meta.title;
  hudTimecode.innerText = meta.timecode;
  hudActLabel.innerText = meta.act;
  stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// --------------------------------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const delta = clock.getDelta();

  scrollVelocity *= 0.9; // decay

  currentMorphProgress += (targetMorphProgress - currentMorphProgress) * 0.05;

  if (shardsMesh && attrInstancePos) {
    shardsMaterial.uniforms.uTime.value = time;
    shardsMaterial.uniforms.uMorphProgress.value = currentMorphProgress;
    
    // Fluid delay: instances lag behind their target morph position
    for(let i=0; i<SHARD_COUNT; i++) {
      const ix = i*3;
      
      const tX = THREE.MathUtils.lerp(targetPos0[ix], targetPos1[ix], currentMorphProgress);
      const tY = THREE.MathUtils.lerp(targetPos0[ix+1], targetPos1[ix+1], currentMorphProgress);
      const tZ = THREE.MathUtils.lerp(targetPos0[ix+2], targetPos1[ix+2], currentMorphProgress);
      
      instPos[ix] += (tX - instPos[ix]) * (0.02 + Math.random()*0.03);
      instPos[ix+1] += (tY - instPos[ix+1]) * (0.02 + Math.random()*0.03);
      instPos[ix+2] += (tZ - instPos[ix+2]) * (0.02 + Math.random()*0.03);
      
      instRot[ix] += instRotSpeed[ix];
      instRot[ix+1] += instRotSpeed[ix+1];
      instRot[ix+2] += instRotSpeed[ix+2];
    }
    attrInstancePos.needsUpdate = true;
    attrInstanceRot.needsUpdate = true;
  }

  if(dustMesh) dustMaterial.uniforms.uTime.value = time;
  if(emberMesh) emberMaterial.uniforms.uTime.value = time;

  // Smooth mouse
  const targetX = (mouseX / window.innerWidth) * 2 - 1;
  const targetY = -(mouseY / window.innerHeight) * 2 + 1;
  
  // Convert mouse to world coordinates for WebGL interaction
  const vector = new THREE.Vector3(targetX, targetY, 0.5);
  vector.unproject(camera);
  const dir = vector.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));
  
  if(shardsMesh) shardsMaterial.uniforms.uMouse.value.lerp(new THREE.Vector2(pos.x, pos.y), 0.1);

  // Parallax camera
  camera.position.x += (targetX * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (targetY * 0.3 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  updateDOMSyncedPlanes();

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
