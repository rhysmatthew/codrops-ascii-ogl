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

  // Create flowing wave pattern
  vec2 flowDirection = vec2(1.0, 0.3); // Direction of wave flow
  float timeOffset = uTime * uSpeed;
  
  // Layer multiple noise octaves for wave-like effect
  float wave1 = cnoise(vec3(vUv * uFrequency + flowDirection * timeOffset, timeOffset * 0.5));
  float wave2 = cnoise(vec3(vUv * uFrequency * 2.0 + flowDirection * timeOffset * 1.5, timeOffset * 0.3)) * 0.5;
  float wave3 = cnoise(vec3(vUv * uFrequency * 0.5 + flowDirection * timeOffset * 0.7, timeOffset * 0.2)) * 0.25;
  
  float noise = (wave1 + wave2 + wave3) * 0.5 + 0.5; // Normalize to 0-1 range
  
  // Dark to light based on noise
  vec3 color = vec3(noise * 0.6);
  
  // Modulate with activity
  fragColor = vec4(color * uActivity, 1.0);
}
