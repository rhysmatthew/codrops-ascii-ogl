import { Camera, Mesh, Plane, Program, Renderer, RenderTarget, Vec2 } from 'ogl';
import { resolveLygia } from 'resolve-lygia';
import { gsap } from 'gsap';

import vertex from '../shaders/vertex.glsl?raw';
import fragment from '../shaders/fragment.glsl?raw';
import asciiVertex from '../shaders/ascii-vertex.glsl?raw';
import asciiFragment from '../shaders/ascii-fragment.glsl?raw';
import redCircleFragment from '../shaders/red-circle-fragment.glsl?raw';

// ------------------------------
// Renderer & GL Setup
// ------------------------------
const renderer = new Renderer();
const gl = renderer.gl;
document.body.appendChild(gl.canvas);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
  const x = (e.clientX / window.innerWidth);
  const y = 1 - (e.clientY / window.innerHeight);
  
  lastMoveTime = performance.now();

  gsap.to(mouse, {
    x,
    y,
    duration: 0.4,
    ease: "expoScale(0.5,7,none)"
  });
  
  // Update mouse pixel position
  // Must account for actual canvas resolution (devicePixelRatio)
  if (perlinProgram && asciiProgram && redCircleProgram) {
    const dpr = renderer.dpr || window.devicePixelRatio || 1;
    const pixel = [e.clientX * dpr, (window.innerHeight - e.clientY) * dpr];
    perlinProgram.uniforms.uMousePixel.value = pixel;
    asciiProgram.uniforms.uMousePixel.value = pixel;
    redCircleProgram.uniforms.uMousePixel.value = pixel;
  }
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
  redCircleProgram.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
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
    uMousePixel: { value: [0, 0] },
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
  fragment: resolveLygia(asciiFragment),
  transparent: true,
  depthTest: false,
  depthWrite: false,
  uniforms: {
    uResolution: { value: [gl.canvas.width, gl.canvas.height] },
    uTexture: { value: renderTarget.texture },
    uMousePixel: { value: [0, 0] },
    uCircleRadius: { value: 160.0 },
    uTime: { value: 0 },
  }
});

const asciiMesh = new Mesh(gl, {
  geometry: new Plane(gl, { width: 2, height: 2 }),
  program: asciiProgram,
});

// ------------------------------
// Red Circle Shader & Mesh
// ------------------------------
const redCircleProgram = new Program(gl, {
  vertex,
  fragment: redCircleFragment,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  uniforms: {
    uResolution: { value: [gl.canvas.width, gl.canvas.height] },
    uMousePixel: { value: [0, 0] },
    uRadius: { value: 160.0 },
  }
});

const redCircleMesh = new Mesh(gl, {
  geometry: new Plane(gl, { width: 2, height: 2 }),
  program: redCircleProgram,
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
  asciiProgram.uniforms.uTime.value = elapsedTime;

  // Update activity based on mouse idle
  const idleTime = (performance.now() - lastMoveTime) / 1000; // convert to seconds
  const fadeDuration = 3;
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

  // 2. Render red circle underneath
  renderer.render({ scene: redCircleMesh, camera });

  // 3. Render ASCII shader on top with transparency
  renderer.render({ scene: asciiMesh, camera, clear: false });
}

// ------------------------------
// Start
// ------------------------------
resize();
requestAnimationFrame(animate);
