---
name: performance-optimization-web
description: WebGL 60fps performance architecture: single draw calls, pixelRatio bounding, GPU instancing, texture caching, disposal, and memory leak prevention.
---

# WebGL 60 FPS Performance Optimization

## 1. Single Draw Call Rule
- Never create hundreds of individual `THREE.Mesh` instances with separate materials.
- Use a single `THREE.Points` or `THREE.InstancedMesh` with a custom `ShaderMaterial`.

## 2. Bounded Pixel Ratio
```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

## 3. Passive Event Listeners
```javascript
window.addEventListener('wheel', handleWheel, { passive: false });
window.addEventListener('touchstart', handleTouch, { passive: true });
window.addEventListener('touchmove', handleTouchMove, { passive: true });
```
