#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uTexture;
uniform sampler2D uMask;
uniform float uTime;
out vec4 fragColor;

#include "lygia/generative/cnoise.glsl"

float character(int n, vec2 p) {
  // p is in [-1,1)
  // map entire 8x8 cell into 5x5 glyph space
  p = floor((p + 1.0) * 0.5 * 5.0);

  // clamp so all pixels resolve to a glyph pixel
  p = clamp(p, 0.0, 4.0);

  int a = int(p.x + 5.0 * p.y);
  return float((n >> a) & 1);
}

void main() {
  vec2 pix = gl_FragCoord.xy;
  
  vec3 col = texture(uTexture, floor(pix / 16.0) * 16.0 / uResolution.xy).rgb;
  float gray = 0.3 * col.r + 0.5 * col.g + 0.11 * col.b;
  
  // Use noise-based brightness determination
  float noise = abs(cnoise(vec3(pix / 128.0, uTime * 0.5)));
  float brightness = gray + noise * 0.3;
  
  int n = 4096;
  n = 11184810;
  if(brightness > 0.3) n = 4526404;
  if(brightness > 0.4) n = 15255086;
  if(brightness > 0.5) n = 15255086;
  if(brightness > 0.6) n = 15255086;
  if(brightness > 0.7) n = 328000;
  if(brightness > 0.8) n = 4526404;
  
  vec2 p = mod(pix / 8.0, 2.0) - vec2(1.0);
  
  float glyph = character(n, p);
  col = vec3(0.0); // All black
  col = col * glyph;

  float mask = texture(uMask, pix / uResolution.xy).r;
  fragColor = vec4(col * mask, 0.25 * glyph * mask);
}
