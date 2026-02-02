import { Camera, Mesh, Plane, Program, Renderer, RenderTarget, Vec2 } from 'ogl';
import { resolveLygia } from 'resolve-lygia';
import { gsap } from 'gsap';

import vertex from '../shaders/vertex.glsl?raw';
import fragment from '../shaders/fragment.glsl?raw';
import asciiVertex from '../shaders/ascii-vertex.glsl?raw';
import asciiFragment from '../shaders/ascii-fragment.glsl?raw';

// ------------------------------
// Renderer & GL Setup
// ------------------------------
const renderer = new Renderer();
const gl = renderer.gl;
document.body.appendChild(gl.canvas);

// ------------------------------
// Camera
// ------------------------------
const camera = new Camera(gl, { near: 0.1, far: 100 });
camera.position.set(0, 0, 3);

// ------------------------------
// Mouse Handling & Activity
// ------------------------------
const mouse = new Vec2();
let lastMoveTime = performance.now();

function updateMouse(e) {
  const rect = gl.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = 1 - (e.clientY - rect.top) / rect.height;

  lastMoveTime = performance.now();

  gsap.to(mouse, {
    x,
    y,
    duration: 0.4,
    ease: "expoScale(0.5,7,none)"
  });
}

window.addEventListener('mousemove', updateMouse);

// ------------------------------
// Resize Handling
// ------------------------------
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });

  perlinProgram.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
  asciiProgram.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
}

window.addEventListener('resize', resize);

// ------------------------------
// Perlin Shader & Mesh
// ------------------------------
const perlinProgram = new Program(gl, {
  vertex,
  fragment: resolveLygia(fragment),
  uniforms: {
    uTime: { value: 0 },
    uFrequency: { value: 3.0 },
    uSpeed: { value: 0.1 },
    uValue: { value: 0.9 },
    uMouseOverPos: { value: mouse },
    uResolution: { value: [gl.canvas.width, gl.canvas.height] },
    uActivity: { value: 0 }
  }
});

const perlinMesh = new Mesh(gl, {
  geometry: new Plane(gl, { width: 2, height: 2 }),
  program: perlinProgram,
});

// Render target for ASCII post-processing
const renderTarget = new RenderTarget(gl);

// ------------------------------
// ASCII Shader & Mesh
// ------------------------------
const asciiProgram = new Program(gl, {
  vertex: asciiVertex,
  fragment: asciiFragment,
  uniforms: {
    uResolution: { value: [gl.canvas.width, gl.canvas.height] },
    uTexture: { value: renderTarget.texture },
  }
});

const asciiMesh = new Mesh(gl, {
  geometry: new Plane(gl, { width: 2, height: 2 }),
  program: asciiProgram,
});

// ------------------------------
// Frame Rate Control
// ------------------------------
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;
let lastTime = 0;

// ------------------------------
// Animation Loop
// ------------------------------
function animate(time) {
  requestAnimationFrame(animate);

  // Frame rate limiting
  if (time - lastTime < frameInterval) return;
  lastTime = time;

  const elapsedTime = time * 0.001;
  perlinProgram.uniforms.uTime.value = elapsedTime;

  // Update activity based on mouse idle
  const idleTime = (performance.now() - lastMoveTime) / 1000; // seconds
  const fadeDuration = 5; // seconds until fully idle
  const targetActivity = Math.max(0, 1 - idleTime / fadeDuration);

  // Smoothly animate activity using GSAP
  gsap.to(perlinProgram.uniforms.uActivity, {
    value: targetActivity,
    duration: 0.5,
    ease: 'power1.out'
  });

  // ------------------------------
  // Render Passes
  // ------------------------------
  // 1. Render Perlin shader to render target
  renderer.render({ scene: perlinMesh, camera, target: renderTarget });

  // 2. Render ASCII shader to screen
  renderer.render({ scene: asciiMesh, camera });
}

// ------------------------------
// Start
// ------------------------------
resize();
requestAnimationFrame(animate);
