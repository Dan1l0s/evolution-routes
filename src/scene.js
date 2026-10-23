import { evolve } from './evolution.js';

export const DURATION = 24;
export const PREVIEW_TIME = 18.2;
export const PALETTES = {
  dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', accent: '#7bc9e8' },
  light: { bg: '#ffffff', fg: '#1f2328', muted: '#68727e', accent: '#267da4' }
};

const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
let evolution;

export function createScene() {
  const data = evolution ??= evolve();
  const arcCache = new Map();

  function stateAt(seconds) {
    const progress = clamp((seconds - 0.4) / 21.8);
    const cursor = progress ** 0.9 * (data.frames.length - 1);
    const index = Math.min(data.frames.length - 1, Math.floor(cursor));
    return { frame: data.frames[index], age: cursor - index, time: clamp(seconds, 0, DURATION) };
  }

  function arc(a, b) {
    const key = data.edgeKey(a, b);
    if (arcCache.has(key)) return arcCache.get(key);
    if (a > b) [a, b] = [b, a];
    const u = data.points[a], v = data.points[b];
    const cosine = clamp(u.reduce((sum, x, i) => sum + x * v[i], 0), -1, 1);
    let tangent = v.map((x, i) => x - cosine * u[i]);
    const norm = Math.hypot(...tangent);
    tangent = tangent.map(x => x / norm);
    const angle = Math.atan2(norm, cosine), steps = Math.max(4, Math.ceil(angle * 17));
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const phase = angle * i / steps;
      return u.map((x, k) => x * Math.cos(phase) + tangent[k] * Math.sin(phase));
    });
    arcCache.set(key, points);
    return points;
  }

  return {
    describe(seconds) {
      const { frame } = stateAt(seconds);
      const improvement = Math.round(100 * (1 - frame.length / data.initialLength));
      if (frame.generation === 0) return `Initial population · ${data.populationSize} routes`;
      if (frame.generation === data.generations) return `${data.generations} generations · route −${improvement}%`;
      const operation = frame.crossed ? frame.mutated ? 'crossover + mutation' : 'crossover' : 'mutation';
      return `Generation ${frame.generation} · ${operation} · route −${improvement}%`;
    },

    draw(ctx, width, height, seconds, palette) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      const { frame, age, time } = stateAt(seconds);
      const yaw = 0.45 + time * 0.065, tilt = -0.38;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      const radius = Math.min(width, height) * 0.43;
      const unit = Math.max(0.65, Math.min(width / 700, height / 440));
      function project(point) {
        const x = cy * point[0] + sy * point[2];
        const z = -sy * point[0] + cy * point[2];
        const y = ct * point[1] - st * z, depth = st * point[1] + ct * z;
        return [width / 2 + x * radius, height / 2 - y * radius, depth];
      }

      ctx.strokeStyle = palette.muted;
      ctx.globalAlpha = 0.23;
      ctx.lineWidth = 0.8 * unit;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, TAU);
      ctx.stroke();

      function route(tour, parent = false, strength = 1) {
        const accentEdges = parent ? new Set() : new Set(frame.accentEdges);
        const bins = Array.from({ length: 20 }, () => [[], []]);
        for (let i = 0; i < data.count; i++) {
          const a = tour[i], b = tour[(i + 1) % data.count];
          const points = arc(a, b).map(project);
          const selected = Number(accentEdges.has(data.edgeKey(a, b)));
          for (let j = 1; j < points.length; j++) {
            const p = points[j - 1], q = points[j];
            const depth = clamp(Math.floor(10 + 5 * (p[2] + q[2])), 0, 19);
            bins[depth][selected].push([p, q]);
          }
        }
        for (let depth = 0; depth < bins.length; depth++) {
          const front = depth / 19;
          for (let accent = 0; accent < 2; accent++) {
            ctx.strokeStyle = accent ? palette.accent : palette.fg;
            ctx.globalAlpha = parent ? (0.035 + 0.19 * front) * strength * (1 - age * 0.35)
              : accent ? 0.23 + 0.71 * front : 0.13 + 0.70 * front ** 1.4;
            ctx.lineWidth = (parent ? 0.8 : accent ? 1.95 : 1.25) * unit;
            ctx.beginPath();
            for (const [a, b] of bins[depth][accent]) {
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
            }
            ctx.stroke();
          }
        }
      }

      frame.parents.forEach((parent, i) => route(parent, true, i === 0 ? 1 : 0.6));
      route(frame.tour);
      const points = data.points.map(project).sort((a, b) => a[2] - b[2]);
      ctx.fillStyle = palette.fg;
      for (const point of points) {
        const front = (point[2] + 1) / 2;
        ctx.globalAlpha = 0.25 + 0.75 * front;
        ctx.beginPath();
        ctx.arc(point[0], point[1], (1.1 + 1.35 * front) * unit, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  };
}
