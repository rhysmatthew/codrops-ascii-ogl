#version 300 es
precision mediump float;
precision mediump sampler2D;

in vec2 vUv;

uniform sampler2D uTexture;
uniform float value;

out vec4 fragColor;

void main() {
  fragColor = value * texture(uTexture, vUv);
}
