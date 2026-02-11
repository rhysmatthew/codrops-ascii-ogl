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

vec2 random2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

void main() {
  vec2 st = vUv;
  st.x *= uResolution.x / uResolution.y;
  
  // Scale by frequency
  st *= uFrequency;
  
  // Tile the space
  vec2 i_st = floor(st);
  vec2 f_st = fract(st);
  
  float m_dist = 1.0;  // minimum distance
  
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      // Neighbor place in the grid
      vec2 neighbor = vec2(float(i), float(j));
      
      // Random position from current + neighbor place in the grid
      vec2 offset = random2(i_st + neighbor);
      
      // Animate the offset slowly
      offset = 0.5 + 0.5 * sin(uTime * uSpeed * 0.5 + 6.2831 * offset);
      
      // Position of the cell
      vec2 pos = neighbor + offset - f_st;
      
      // Cell distance
      float dist = length(pos);
      
      // Metaball it!
      m_dist = min(m_dist, m_dist * dist);
    }
  }
  
  // Create gradient from metaball field
  float value = 1.0 - smoothstep(0.0, 0.7, m_dist);
  
  // Subtle dark gradient
  vec3 color = vec3(value * 0.5);
  
  fragColor = vec4(color, 1.0);
}
