/**
 * The environment shader.
 *
 * A layered noise field that drifts as the page scrolls: two slow-moving
 * bands of accent light over the near-black ground, with grain and a vignette
 * so it reads as atmosphere rather than as a gradient.
 *
 * Every colour arrives as a uniform read from the CSS design tokens, so the
 * scene stays tied to the palette rather than hardcoding values here.
 */

export const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uScroll;      // 0..1 through the document
  uniform float uVelocity;    // smoothed scroll speed
  uniform vec2  uPointer;     // 0..1, centre is 0.5
  uniform vec2  uResolution;
  uniform vec3  uBg;
  uniform vec3  uAccent;
  uniform vec3  uFg;

  varying vec2 vUv;

  // -- value noise ---------------------------------------------------------
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Correct for aspect so the field does not stretch on wide viewports.
    vec2 uv = vUv;
    vec2 p = uv;
    p.x *= uResolution.x / max(uResolution.y, 1.0);

    // The pointer pulls the field very slightly, so the scene feels aware of
    // the cursor without chasing it.
    vec2 pointerOffset = (uPointer - 0.5) * 0.12;

    float t = uTime * 0.02;
    float scrollDrift = uScroll * 1.6;

    // Two layers moving at different rates: this is what gives depth.
    float far = fbm(p * 1.6 + vec2(t, -scrollDrift * 0.6) + pointerOffset * 0.4);
    float near = fbm(p * 3.1 + vec2(-t * 1.4, -scrollDrift) + pointerOffset);

    // Soft bands that sweep through as the page advances.
    float band = smoothstep(0.35, 0.85, far * 0.7 + near * 0.5);
    float glow = pow(band, 2.4);

    // The accent warms up through the middle of the page and cools at the
    // ends, so the journey has a temperature curve rather than one flat mood.
    float warmth = sin(uScroll * 3.14159) * 0.6 + 0.25;

    vec3 colour = uBg;
    colour += uAccent * glow * 0.16 * warmth;
    colour += uFg * pow(near, 4.0) * 0.02;

    // Faster scrolling brightens the field slightly, like light smearing.
    colour += uAccent * uVelocity * 0.05 * glow;

    // Vignette keeps the edges dark so text stays legible over it.
    float d = distance(uv, vec2(0.5));
    colour *= 1.0 - smoothstep(0.35, 0.95, d) * 0.85;

    // Grain, to kill banding on a near-black gradient.
    float grain = (hash(uv * uResolution + fract(uTime)) - 0.5) * 0.02;
    colour += grain;

    gl_FragColor = vec4(colour, 1.0);
  }
`;
