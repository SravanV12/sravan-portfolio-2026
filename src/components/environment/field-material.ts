/**
 * The environment shader.
 *
 * Domain-warped noise — fbm whose input is itself displaced by fbm — which is
 * what makes it read as moving fluid rather than as a scrolling texture. On
 * top of that: a scroll-driven camera push, light streaks that sweep with the
 * page, and a colour temperature that travels through the palette as you
 * descend.
 *
 * Octave counts are kept deliberately low. This fills the viewport, so every
 * extra octave is another few million noise samples per frame for detail that
 * a background blurred behind text will never show.
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

  // Three octaves, not four. Every octave is another full-screen noise lookup;
  // the fourth was invisible behind the blur and cost as much as the first.
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // -- camera ------------------------------------------------------------
    // Scrolling pushes into the field and drifts it upward, so the page feels
    // like it is travelling through the environment rather than past it.
    float travel = uScroll * 2.2;
    float zoom = 1.0 - uScroll * 0.18 + uVelocity * 0.05;
    vec2 p = (uv - 0.5) * zoom + 0.5;
    p.x *= aspect;

    vec2 pointerOffset = (uPointer - 0.5) * 0.18;
    float t = uTime * 0.025;

    // -- domain warping ----------------------------------------------------
    // One warp level, not two. The first displacement is what makes the field
    // curl and fold; the second was five more full-screen fbm evaluations for
    // a difference nobody can see behind a vignette. Measured on software
    // rendering, the two-level version cost 4.2s of main-thread blocking.
    vec2 q = vec2(
      fbm(p * 1.3 + vec2(t, -travel * 0.5)),
      fbm(p * 1.3 + vec2(-t * 0.8, -travel * 0.4) + 3.7)
    );

    float field = fbm(p * 2.4 + q * 2.0 + vec2(0.0, -travel * 1.2) + pointerOffset);
    vec2 r = q;

    // -- light -------------------------------------------------------------
    float core = smoothstep(0.32, 0.86, field);
    float glow = pow(core, 2.2);

    // Streaks: thin, fast-moving highlights that read as light through haze.
    // Reuses the field rather than sampling fresh noise — a cheap trick that
    // looks the same because the streaks sit inside the same structure.
    float streak = pow(
      smoothstep(0.55, 1.0, fract(field * 3.0 + p.y * 1.6 - travel * 1.2)),
      4.0
    );

    // Temperature travels through the page: cool at the top, warm through the
    // middle where the work sits, cooling again towards contact.
    float warmth = sin(uScroll * 3.14159) * 0.75 + 0.3;

    // A second, cooler tone so the palette is not one flat accent wash.
    vec3 cool = mix(uAccent, uFg, 0.72);

    // Additive terms are kept small and few. Each one looks harmless alone;
    // stacked, they clip to white and take the page's contrast with them.
    vec3 colour = uBg;
    colour += uAccent * glow * 0.17 * warmth;
    colour += cool * pow(core, 4.0) * 0.05;
    colour += uAccent * streak * 0.06 * (0.4 + uVelocity * 1.2);

    // Depth haze: the far field lifts slightly so the image has atmosphere
    // rather than sitting flat against the background.
    colour += cool * smoothstep(0.0, 1.0, r.y) * 0.012;

    // Scrolling fast smears more light through the frame.
    colour += uAccent * uVelocity * 0.06 * glow;

    // The ceiling. Text sits on top of this, and the contrast ratios in the
    // palette assume a near-black ground — so the environment is not allowed
    // to climb past a dim wash however the terms above happen to land.
    // 0.18 is not a taste value — it is the brightest this may go while
    // secondary text still clears 4.5:1 against it. At 0.34 that ratio fell to
    // 1.81:1, which no automated audit catches because Lighthouse reads CSS
    // colours, not canvas pixels. Raising this means re-checking the palette.
    colour = min(colour, uBg + 0.18);

    // Vignette keeps the edges dark so text stays legible over it.
    float d = distance(uv, vec2(0.5));
    colour *= 1.0 - smoothstep(0.30, 0.98, d) * 0.88;

    // Grain, to kill banding on a near-black gradient.
    float grain = (hash(uv * uResolution + fract(uTime)) - 0.5) * 0.022;
    colour += grain;

    gl_FragColor = vec4(colour, 1.0);
  }
`;
