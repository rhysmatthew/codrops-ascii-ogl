#version 300 es
precision mediump float;
uniform float uFrequency;
uniform float uTime;
uniform float uSpeed;
uniform float uValue;
uniform vec2 uMouseOverPos;
uniform vec2 uMousePixel;
uniform vec2 uResolution;
uniform float uActivity;

in vec2 vUv;
out vec4 fragColor;

#include "lygia/generative/cnoise.glsl"

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 mouse = uMouseOverPos;
  float mouseDistance = distance(vUv, mouse);

  float noise = abs(cnoise(vec3(vUv * uFrequency - 0.25, uTime * uSpeed)));
  
  // Dark to light based on noise
  vec3 color = vec3(noise * 0.6);
  
  // Modulate with activity
  fragColor = vec4(color * uActivity, 1.0);
}
