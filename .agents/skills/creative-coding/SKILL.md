---
name: creative-coding
description: Creative coding and generative art patterns (Codrops level): curl noise, breathing forms, logarithmic spiral trajectories, dual-tone lighting, procedural fiber textures.
---

# Creative Coding & Generative Art Patterns

## 1. Simplex 3D Curl Noise in GLSL
Incompressible fluid flow simulation for natural particulate dispersal:
```glsl
vec3 curl(vec3 p) {
  float e = 0.1;
  float dx = snoise(p + vec3(e, 0.0, 0.0)) - snoise(p - vec3(e, 0.0, 0.0));
  float dy = snoise(p + vec3(0.0, e, 0.0)) - snoise(p - vec3(0.0, e, 0.0));
  float dz = snoise(p + vec3(0.0, 0.0, e)) - snoise(p - vec3(0.0, 0.0, e));
  return vec3(dy - dz, dz - dx, dx - dy) / (2.0 * e);
}
```

## 2. Organic Breathing
When resting in a crystallized state, avoid mechanical rigidity:
```glsl
if (morphArc < 0.05 && abs(uVelocity) < 0.05) {
  currentPos += vec3(sin(uTime * 1.5 + currentPos.y) * 0.015, cos(uTime * 1.5 + currentPos.x) * 0.015, 0.0);
}
```

## 3. Dual-Tone Edge Glow Shading
```glsl
float rim = smoothstep(0.28, 0.48, dist);
vec3 goldRim = vec3(0.98, 0.88, 0.70);
vec3 finalColor = mix(vColor, goldRim, rim * 0.45);
```
