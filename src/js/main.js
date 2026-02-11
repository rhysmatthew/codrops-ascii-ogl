import { Camera, Mesh, Plane, Program, Renderer, RenderTarget, Vec2, Geometry, Color } from 'ogl';
import { resolveLygia } from 'resolve-lygia';
import { gsap } from 'gsap';
import GUI from 'lil-gui';

import vertex from '../shaders/vertex.glsl?raw';
import fragment from '../shaders/fragment.glsl?raw';
import asciiVertex from '../shaders/ascii-vertex.glsl?raw';
import asciiFragment from '../shaders/ascii-fragment.glsl?raw';
import fluidBaseVertex from '../shaders/fluid/base-vertex.glsl?raw';
import fluidClearFragment from '../shaders/fluid/clear-fragment.glsl?raw';
import fluidSplatFragment from '../shaders/fluid/splat-fragment.glsl?raw';
import fluidAdvectionFragment from '../shaders/fluid/advection-fragment.glsl?raw';
import fluidDivergenceFragment from '../shaders/fluid/divergence-fragment.glsl?raw';
import fluidCurlFragment from '../shaders/fluid/curl-fragment.glsl?raw';
import fluidVorticityFragment from '../shaders/fluid/vorticity-fragment.glsl?raw';
import fluidPressureFragment from '../shaders/fluid/pressure-fragment.glsl?raw';
import fluidGradientSubtractFragment from '../shaders/fluid/gradient-subtract-fragment.glsl?raw';

// ------------------------------
// Renderer & GL Setup
// ------------------------------
const renderer = new Renderer({ alpha: true });
const gl = renderer.gl;
document.body.appendChild(gl.canvas);
gl.clearColor(0, 0, 0, 0);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

// ------------------------------
// Camera
// ------------------------------
const camera = new Camera(gl, { near: 0.1, far: 100 });
camera.position.set(0, 0, 3);

// ------------------------------
// Mouse Handling & Activity
// ------------------------------
const mouse = new Vec2();
const lastMouse = new Vec2();
const splats = [];
let lastMoveTime = performance.now();
let movementActivity = 0;
let lastMoveTs = performance.now();

function updateMouse(e) {
  const x = (e.clientX / window.innerWidth);
  const y = 1 - (e.clientY / window.innerHeight);
  
  lastMoveTime = performance.now();

  gsap.to(mouse, {
    x,
    y,
    duration: 3,
    ease: "expoScale(0.5,7,none)"
  });
  
  if (!lastMouse.isInit) {
    lastMouse.isInit = true;
    lastMouse.set(e.clientX, e.clientY);
  }

  const now = performance.now();
  const dt = Math.max(0.001, (now - lastMoveTs) / 1000);
  const deltaX = e.clientX - lastMouse.x;
  const deltaY = e.clientY - lastMouse.y;
  lastMouse.set(e.clientX, e.clientY);
  lastMoveTs = now;

  const speed = Math.hypot(deltaX, deltaY) / dt; // px/sec
  const targetActivity = Math.min(1, Math.max(0, (speed - 50) / 600));
  movementActivity += (targetActivity - movementActivity) * 0.15;

  if (Math.abs(deltaX) || Math.abs(deltaY)) {
    splats.push({
      x: e.clientX / renderer.width,
      y: 1 - e.clientY / renderer.height,
      dx: deltaX * 5,
      dy: deltaY * -5,
    });
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
    uFrequency: { value: 0.5 },
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
// Fluid Simulation (mask)
// ------------------------------
const fluidSettings = {
  simRes: 128,
  dyeRes: 1024,
  iterations: 4,
  decay: 0.896,
  velocityDissipation: 0.6,
  pressureDissipation: 0.85,
  curlStrength: 10,
  radius: 0.5,
};

let texelSize;
let density;
let velocity;
let pressure;
let divergence;
let curl;
let clearProgram;
let splatProgram;
let advectionProgram;
let divergenceProgram;
let curlProgram;
let vorticityProgram;
let pressureProgram;
let gradientSubtractProgram;

const triangle = new Geometry(gl, {
  position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
  uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
});

function supportRenderTextureFormat(gl, internalFormat, format, type) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  return status === gl.FRAMEBUFFER_COMPLETE;
}

function getSupportedFormat(gl, internalFormat, format, type) {
  if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
    switch (internalFormat) {
      case gl.R16F:
        return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
      case gl.RG16F:
        return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
      default:
        return null;
    }
  }

  return { internalFormat, format };
}

function createDoubleFBO(gl, { width, height, wrapS, wrapT, minFilter = gl.LINEAR, magFilter = minFilter, type, format, internalFormat, depth } = {}) {
  const options = { width, height, wrapS, wrapT, minFilter, magFilter, type, format, internalFormat, depth };
  const fbo = {
    read: new RenderTarget(gl, options),
    write: new RenderTarget(gl, options),
    swap: () => {
      const temp = fbo.read;
      fbo.read = fbo.write;
      fbo.write = temp;
    },
  };
  return fbo;
}

function setupFluid() {
  const supportLinearFiltering = gl.renderer.extensions[`OES_texture_${gl.renderer.isWebgl2 ? `` : `half_`}float_linear`];
  const halfFloat = gl.renderer.isWebgl2 ? gl.HALF_FLOAT : gl.renderer.extensions['OES_texture_half_float'].HALF_FLOAT_OES;
  const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

  let rgba;
  let rg;
  let r;

  if (gl.renderer.isWebgl2) {
    rgba = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloat);
    rg = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloat);
    r = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloat);
  } else {
    rgba = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloat);
    rg = rgba;
    r = rgba;
  }

  texelSize = { value: new Vec2(1 / fluidSettings.simRes, 1 / fluidSettings.simRes) };

  density = createDoubleFBO(gl, {
    width: fluidSettings.dyeRes,
    height: fluidSettings.dyeRes,
    type: halfFloat,
    format: rgba?.format,
    internalFormat: rgba?.internalFormat,
    minFilter: filtering,
    depth: false,
  });

  velocity = createDoubleFBO(gl, {
    width: fluidSettings.simRes,
    height: fluidSettings.simRes,
    type: halfFloat,
    format: rg?.format,
    internalFormat: rg?.internalFormat,
    minFilter: filtering,
    depth: false,
  });

  pressure = createDoubleFBO(gl, {
    width: fluidSettings.simRes,
    height: fluidSettings.simRes,
    type: halfFloat,
    format: r?.format,
    internalFormat: r?.internalFormat,
    minFilter: gl.NEAREST,
    depth: false,
  });

  divergence = new RenderTarget(gl, {
    width: fluidSettings.simRes,
    height: fluidSettings.simRes,
    type: halfFloat,
    format: r?.format,
    internalFormat: r?.internalFormat,
    minFilter: gl.NEAREST,
    depth: false,
  });

  curl = new RenderTarget(gl, {
    width: fluidSettings.simRes,
    height: fluidSettings.simRes,
    type: halfFloat,
    format: r?.format,
    internalFormat: r?.internalFormat,
    minFilter: gl.NEAREST,
    depth: false,
  });

  clearProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidClearFragment,
      uniforms: {
        texelSize,
        uTexture: { value: null },
        value: { value: fluidSettings.pressureDissipation },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  splatProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidSplatFragment,
      uniforms: {
        texelSize,
        uTarget: { value: null },
        aspectRatio: { value: 1 },
        color: { value: new Color() },
        point: { value: new Vec2() },
        radius: { value: fluidSettings.radius / 100 },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  advectionProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidAdvectionFragment,
      uniforms: {
        texelSize,
        dyeTexelSize: { value: new Vec2(1 / fluidSettings.dyeRes, 1 / fluidSettings.dyeRes) },
        uVelocity: { value: null },
        uSource: { value: null },
        dt: { value: 0.016 },
        dissipation: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  divergenceProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidDivergenceFragment,
      uniforms: {
        texelSize,
        uVelocity: { value: null },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  curlProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidCurlFragment,
      uniforms: {
        texelSize,
        uVelocity: { value: null },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  vorticityProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidVorticityFragment,
      uniforms: {
        texelSize,
        uVelocity: { value: null },
        uCurl: { value: null },
        curl: { value: fluidSettings.curlStrength },
        dt: { value: 0.05 },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  pressureProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidPressureFragment,
      uniforms: {
        texelSize,
        uPressure: { value: null },
        uDivergence: { value: null },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });

  gradientSubtractProgram = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, {
      vertex: fluidBaseVertex,
      fragment: fluidGradientSubtractFragment,
      uniforms: {
        texelSize,
        uPressure: { value: null },
        uVelocity: { value: null },
      },
      depthTest: false,
      depthWrite: false,
    }),
  });
}

setupFluid();

const gui = new GUI();
gui.title('Fluid');

gui.add(perlinProgram.uniforms.uFrequency, 'value', 0.1, 10, 0.1).name('perlinFrequency');

gui.add(fluidSettings, 'simRes', 32, 512, 1).onFinishChange(setupFluid);
gui.add(fluidSettings, 'dyeRes', 128, 2048, 1).onFinishChange(setupFluid);
gui.add(fluidSettings, 'iterations', 1, 20, 1);
gui.add(fluidSettings, 'decay', 0.5, 1, 0.001);
gui.add(fluidSettings, 'velocityDissipation', 0.1, 1, 0.001);
gui.add(fluidSettings, 'pressureDissipation', 0.5, 1, 0.001).onChange((value) => {
  if (clearProgram) {
    clearProgram.program.uniforms.value.value = value;
  }
});
gui.add(fluidSettings, 'curlStrength', 0, 50, 0.1).onChange((value) => {
  if (vorticityProgram) {
    vorticityProgram.program.uniforms.curl.value = value;
  }
});
gui.add(fluidSettings, 'radius', 0.1, 3, 0.01).onChange((value) => {
  if (splatProgram) {
    splatProgram.program.uniforms.radius.value = value / 100;
  }
});

function splat({ x, y, dx, dy }) {
  splatProgram.program.uniforms.uTarget.value = velocity.read.texture;
  splatProgram.program.uniforms.aspectRatio.value = renderer.width / renderer.height;
  splatProgram.program.uniforms.point.value.set(x, y);
  splatProgram.program.uniforms.color.value.set(dx, dy, 1);

  renderer.render({
    scene: splatProgram,
    target: velocity.write,
    sort: false,
    update: false,
  });
  velocity.swap();

  splatProgram.program.uniforms.uTarget.value = density.read.texture;
  const intensity = Math.min(6, Math.max(1, Math.sqrt(dx * dx + dy * dy)));
  const scaled = intensity * movementActivity;
  splatProgram.program.uniforms.color.value.set(scaled, scaled, scaled);

  renderer.render({
    scene: splatProgram,
    target: density.write,
    sort: false,
    update: false,
  });
  density.swap();
}

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
    uMask: { value: density.read.texture },
    uPerlin: { value: renderTarget.texture },
    uDistortionStrength: { value: 0.015 },
    uTime: { value: 0 }
  }
});

const asciiMesh = new Mesh(gl, {
  geometry: new Plane(gl, { width: 2, height: 2 }),
  program: asciiProgram,
});


// ------------------------------
// Blue Fluid Display Shader
// ------------------------------
const blueFluidVertex = `#version 300 es
  in vec2 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0, 1);
  }
`;

const blueFluidFragment = `#version 300 es
  precision highp float;
  uniform sampler2D uTexture;
  in vec2 vUv;
  out vec4 fragColor;
  
  void main() {
    vec3 fluid = texture(uTexture, vUv).rgb;
    float intensity = length(fluid);
    
    float softEdge = pow(intensity, 2.0);
    
    // Use constant blue, not intensity-based
    vec3 blue = vec3(0.0, 0.0, 0.25);
    fragColor = vec4(blue, softEdge);
  }
`;

// const blueFluidProgram = new Program(gl, {
//   vertex: blueFluidVertex,
//   fragment: blueFluidFragment,
//   transparent: true,
//   uniforms: {
//     uTexture: { value: density.read.texture }
//   }
// });

// const blueFluidMesh = new Mesh(gl, {
//   geometry: new Plane(gl, { width: 2, height: 2 }),
//   program: blueFluidProgram
// });

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

  // movementActivity is updated on mouse events using velocity

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

  renderer.autoClear = false;

  for (let i = splats.length - 1; i >= 0; i--) {
    splat(splats.splice(i, 1)[0]);
  }

  curlProgram.program.uniforms.uVelocity.value = velocity.read.texture;
  renderer.render({ scene: curlProgram, target: curl, sort: false, update: false });

  vorticityProgram.program.uniforms.uVelocity.value = velocity.read.texture;
  vorticityProgram.program.uniforms.uCurl.value = curl.texture;
  renderer.render({ scene: vorticityProgram, target: velocity.write, sort: false, update: false });
  velocity.swap();

  divergenceProgram.program.uniforms.uVelocity.value = velocity.read.texture;
  renderer.render({ scene: divergenceProgram, target: divergence, sort: false, update: false });

  clearProgram.program.uniforms.uTexture.value = pressure.read.texture;
  renderer.render({ scene: clearProgram, target: pressure.write, sort: false, update: false });
  pressure.swap();

  pressureProgram.program.uniforms.uDivergence.value = divergence.texture;
  for (let i = 0; i < fluidSettings.iterations; i++) {
    pressureProgram.program.uniforms.uPressure.value = pressure.read.texture;
    renderer.render({ scene: pressureProgram, target: pressure.write, sort: false, update: false });
    pressure.swap();
  }

  gradientSubtractProgram.program.uniforms.uPressure.value = pressure.read.texture;
  gradientSubtractProgram.program.uniforms.uVelocity.value = velocity.read.texture;
  renderer.render({ scene: gradientSubtractProgram, target: velocity.write, sort: false, update: false });
  velocity.swap();

  advectionProgram.program.uniforms.dyeTexelSize.value.set(1 / fluidSettings.simRes);
  advectionProgram.program.uniforms.uVelocity.value = velocity.read.texture;
  advectionProgram.program.uniforms.uSource.value = velocity.read.texture;
  advectionProgram.program.uniforms.dissipation.value = fluidSettings.velocityDissipation;
  renderer.render({ scene: advectionProgram, target: velocity.write, sort: false, update: false });
  velocity.swap();

  advectionProgram.program.uniforms.dyeTexelSize.value.set(1 / fluidSettings.dyeRes);
  advectionProgram.program.uniforms.uVelocity.value = velocity.read.texture;
  advectionProgram.program.uniforms.uSource.value = density.read.texture;
  advectionProgram.program.uniforms.dissipation.value = fluidSettings.decay;
  renderer.render({ scene: advectionProgram, target: density.write, sort: false, update: false });
  density.swap();

  renderer.autoClear = true;

  asciiProgram.uniforms.uMask.value = density.read.texture;
  // blueFluidProgram.uniforms.uTexture.value = density.read.texture;

  // ------------------------------
  // Render Passes
  // ------------------------------
  // Clear and render perlin to render target first
  renderer.render({ scene: perlinMesh, camera, target: renderTarget });
  
  // Render blue fluid to screen (underneath ASCII)
  // renderer.autoClear = false;
  // renderer.render({ scene: blueFluidMesh });
  
  // Render ASCII on top
  renderer.render({ scene: asciiMesh });
  
  renderer.autoClear = true;
}

// ------------------------------
// Start
// ------------------------------
resize();
requestAnimationFrame(animate);
