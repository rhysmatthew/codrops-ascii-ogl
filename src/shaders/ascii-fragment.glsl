#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uTexture;
out vec4 fragColor;

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
  int n = 4096;
  n = 11184810;
  if(gray > 0.3) n = 4526404;
  if(gray > 0.4) n = 15255086;
  if(gray > 0.5) n = 15255086;
  if(gray > 0.6) n = 15255086;
  if(gray > 0.7) n = 328000;
  if(gray > 0.8) n = 4526404;
  vec2 p = mod(pix / 8.0, 2.0) - vec2(1.0);
  
  col = col * character(n, p);
  fragColor = vec4(col, 1.0);
}
