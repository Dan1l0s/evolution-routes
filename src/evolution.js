const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function random(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function evolve() {
  const rng = random(714321);
  const count = 74;
  const populationSize = 80;
  const generations = 2400;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points = Array.from({ length: count }, (_, i) => {
    const angle = goldenAngle * i + (rng() - 0.5) * 0.12;
    const z = 1 - 2 * (i + 0.5) / count;
    const radius = Math.sqrt(1 - z * z);
    return [radius * Math.cos(angle), radius * Math.sin(angle), z];
  });
  const distances = points.map(a => points.map(b =>
    Math.acos(clamp(a.reduce((sum, x, i) => sum + x * b[i], 0), -1, 1))
  ));
  const length = tour => tour.reduce((sum, a, i) => sum + distances[a][tour[(i + 1) % count]], 0);
  const edgeKey = (a, b) => Math.min(a, b) * count + Math.max(a, b);

  function shuffled() {
    const tour = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tour[i], tour[j]] = [tour[j], tour[i]];
    }
    return tour;
  }

  function child(a, b) {
    let tour, accentEdges = [];
    const crossed = rng() < 0.8;
    if (crossed) {
      let left = Math.floor(rng() * count), right = Math.floor(rng() * count);
      if (left > right) [left, right] = [right, left];
      tour = new Array(count).fill(-1);
      const used = new Uint8Array(count);
      for (let i = left; i <= right; i++) {
        tour[i] = a[i];
        used[a[i]] = 1;
        if (i > left) accentEdges.push(edgeKey(a[i - 1], a[i]));
      }
      // Keep one parent's segment, then fill the remaining positions in the other's order.
      let position = (right + 1) % count;
      for (let i = 0; i < count; i++) {
        const vertex = b[(right + 1 + i) % count];
        if (!used[vertex]) {
          tour[position] = vertex;
          position = (position + 1) % count;
        }
      }
    } else tour = a.slice();

    const mutated = rng() < 0.8;
    if (mutated) {
      let left = Math.floor(rng() * count), right = Math.floor(rng() * count);
      if (left > right) [left, right] = [right, left];
      while (left < right) {
        [tour[left], tour[right]] = [tour[right], tour[left]];
        left++;
        right--;
      }
    }
    if (!crossed) {
      const oldEdges = new Set(a.map((vertex, i) => edgeKey(vertex, a[(i + 1) % count])));
      accentEdges = tour.flatMap((vertex, i) => {
        const edge = edgeKey(vertex, tour[(i + 1) % count]);
        return oldEdges.has(edge) ? [] : [edge];
      });
    }
    return { tour, length: length(tour), parents: crossed ? [a, b] : [a], accentEdges, crossed, mutated };
  }

  let population = Array.from({ length: populationSize }, () => {
    const tour = shuffled();
    return { tour, length: length(tour), parents: [], accentEdges: [], crossed: false, mutated: false };
  });
  population.sort((a, b) => a.length - b.length);
  const initialLength = population[0].length;
  const frames = [{ ...population[0], generation: 0 }];

  function select() {
    let best = Math.floor(rng() * populationSize);
    for (let attempt = 0; attempt < 3; attempt++) best = Math.min(best, Math.floor(rng() * populationSize));
    return population[best].tour;
  }

  for (let generation = 1; generation <= generations; generation++) {
    const next = population.slice(0, 4);
    while (next.length < populationSize) next.push(child(select(), select()));
    next.sort((a, b) => a.length - b.length);
    if (next[0].length < population[0].length - 1e-10) frames.push({ ...next[0], generation });
    population = next;
  }
  frames.push({ ...population[0], parents: [], accentEdges: [], generation: generations });
  return { count, points, distances, frames, edgeKey, initialLength, populationSize, generations };
}
