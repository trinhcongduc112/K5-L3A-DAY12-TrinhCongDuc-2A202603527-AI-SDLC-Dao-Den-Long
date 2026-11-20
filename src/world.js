export const HZ = 60;
export const DT = 1 / HZ;

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function ring(count, radius, { x = 0, y = 0, z = 0, angle = 0, step = 360 / count } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const heading = (angle + index * step) * Math.PI / 180;
    return [x + radius * Math.cos(heading), y, z + radius * Math.sin(heading)];
  });
}

export const worlds = {
  1: {
    title: 'Đảo Bến',
    disks: [{ x: 0, y: 0, z: 0, radius: 40 }],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    moteSpots: [...ring(8, 12), ...ring(16, 33)],
    shadeSpots: ring(12, 37, { angle: 15 }),
    shadeInterval: 480,
    shadeLimit: 6,
  },
};

export function horizontalDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function direction(x, z, fallback = [0, 0]) {
  const length = Math.hypot(x, z);
  return length ? [x / length, z / length] : fallback;
}

export function inputDirection(move, yaw) {
  const radians = yaw * Math.PI / 180;
  const length = Math.max(1, Math.hypot(...move));
  const [x, z] = move.map(component => component / length);
  return [x * Math.cos(radians) + z * Math.sin(radians), -x * Math.sin(radians) + z * Math.cos(radians)];
}
