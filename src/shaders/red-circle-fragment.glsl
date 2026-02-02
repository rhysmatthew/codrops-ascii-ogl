#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uMousePixel;
uniform float uRadius;

out vec4 fragColor;

void main() {
  vec2 pix = gl_FragCoord.xy;
  float dist = distance(pix, uMousePixel);

  float edge = smoothstep(uRadius, uRadius - 12.0, dist);
  vec3 color = vec3(0.8, 0.0, 0.0);

  fragColor = vec4(color, edge);
}
