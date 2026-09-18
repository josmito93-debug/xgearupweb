/**
 * Rare UI Component Adapters
 * Source: swamimalode07/rare-ui
 * Components: FluidOrb, MatrixOrb
 */

// ===================================================================
// FLUID ORB (WebGL Fragment Shader Liquid Orb)
// ===================================================================

const FLUID_VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FLUID_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;

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
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.22;

  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );

  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.7;

  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 1.2 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  float shade = clamp(g + (f - 0.5) * 0.8 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.99, 1.0, 1.0);
  vec3 light = mix(white, u_color, 0.5);
  vec3 dark = u_color;

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.58, 0.88, shade));

  float edge = smoothstep(0.5, 0.49, distance(uv, vec2(0.5)));

  gl_FragColor = vec4(col * edge, edge);
}
`;

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0.1, 0.45, 0.95];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class FluidOrbInstance {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.size = options.size || 480;
    this.currentColor = hexToRgb(options.color || '#5c6c39');
    this.targetColor = [...this.currentColor];

    this.init();
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) {
      console.warn('WebGL not supported for FluidOrb');
      return;
    }
    this.gl = gl;

    const program = gl.createProgram();
    const vert = compileShader(gl, gl.VERTEX_SHADER, FLUID_VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FLUID_FRAG);
    if (!program || !vert || !frag) return;

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    this.program = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.uResolution = gl.getUniformLocation(program, 'u_resolution');
    this.uTime = gl.getUniformLocation(program, 'u_time');
    this.uColor = gl.getUniformLocation(program, 'u_color');

    this.updateSize();
    this.start = performance.now();
    this.render = this.render.bind(this);
    this.raf = requestAnimationFrame(this.render);
  }

  updateSize() {
    if (!this.gl || !this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(this.size * dpr);
    this.canvas.width = px;
    this.canvas.height = px;
    this.gl.viewport(0, 0, px, px);
    this.gl.uniform2f(this.uResolution, px, px);
  }

  setColor(hexColor) {
    this.targetColor = hexToRgb(hexColor);
  }

  render(now) {
    if (!this.gl) return;

    // Smoothly lerp color components towards targetColor
    for (let i = 0; i < 3; i++) {
      this.currentColor[i] += (this.targetColor[i] - this.currentColor[i]) * 0.08;
    }

    this.gl.uniform3f(
      this.uColor,
      this.currentColor[0],
      this.currentColor[1],
      this.currentColor[2]
    );

    const timeInSec = (now - this.start) / 1000;
    this.gl.uniform1f(this.uTime, timeInSec);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.raf = requestAnimationFrame(this.render);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// ===================================================================
// MATRIX ORB (Point-cloud Particle Simulation)
// ===================================================================

const TAU = Math.PI * 2;
const MATRIX_ORBITERS = [
  { radius: 0.62, speed: 2.2, phase: 0, spread: 0.42 },
  { radius: 0.4, speed: -1.7, phase: 2.1, spread: 0.36 },
  { radius: 0.8, speed: 1.15, phase: 4, spread: 0.34 },
];

function matrixIntensity(state, d, nx, ny, t, amplitude = 0.5) {
  if (state === 'listening') {
    const ripple = 0.5 + 0.5 * Math.sin(d * 4.2 - t * 3);
    return 0.32 + amplitude * (0.34 + 0.38 * ripple);
  }

  if (state === 'thinking') {
    let heat = 0;
    for (const o of MATRIX_ORBITERS) {
      const a = t * o.speed + o.phase;
      const dx = nx - Math.cos(a) * o.radius;
      const dy = ny - Math.sin(a) * o.radius;
      heat += Math.exp(-(dx * dx + dy * dy) / (o.spread * o.spread));
    }
    return 0.26 + 0.8 * Math.min(1, heat);
  }

  return 0.62 + 0.12 * Math.sin(t * 1.05 - d * 2.4);
}

export class MatrixOrbInstance {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.size = options.size || 54;
    this.dots = options.dots || 9;
    this.color = options.color || '#f200a0';
    this.state = options.state || 'thinking';

    this.init();
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.ctx.scale(dpr, dpr);

    this.start = performance.now();
    this.render = this.render.bind(this);
    this.raf = requestAnimationFrame(this.render);
  }

  setState(newState) {
    this.state = newState;
  }

  setColor(newColor) {
    this.color = newColor;
  }

  render(now) {
    const ctx = this.ctx;
    if (!ctx) return;

    const t = (now - this.start) / 1000;
    const w = this.size;
    const h = this.size;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 4;

    ctx.clearRect(0, 0, w, h);

    const step = (r * 2) / (this.dots - 1);
    for (let i = 0; i < this.dots; i++) {
      for (let j = 0; j < this.dots; j++) {
        const x = -r + i * step;
        const y = -r + j * step;
        const d = Math.sqrt(x * x + y * y) / r;
        if (d > 1) continue;

        const nx = x / r;
        const ny = y / r;
        const intensity = matrixIntensity(this.state, d, nx, ny, t);
        const ptSize = 1.2 + intensity * 1.6;

        ctx.beginPath();
        ctx.arc(cx + x, cy + y, ptSize, 0, TAU);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.min(1, Math.max(0.1, intensity));
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    this.raf = requestAnimationFrame(this.render);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
