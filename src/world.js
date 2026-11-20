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
  2: {
    title: 'Đảo Cau',
    disks: [{ x: 0, y: 0, z: 0, radius: 28 }, { x: 70, y: 0, z: 0, radius: 28 }],
    bridge: { minX: 26, maxX: 44, minZ: -2, maxZ: 2 },
    pads: [
      { pos: [20, 0, 18], target: [70, 0], lift: 14, speed: 24 },
      { pos: [50, 0, -18], target: [0, 0], lift: 14, speed: 24 },
    ],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    moteSpots: [0, 70].flatMap(x => [...ring(4, 10, { x }), ...ring(8, 22, { x })]),
    shadeSpots: [0, 70].flatMap(x => ring(8, 26, { x, angle: 22.5 })),
    charmSpots: [[35, 0, 0]],
    shadeInterval: 420,
    shadeLimit: 8,
  },
  3: {
    title: 'Đảo Chuông',
    disks: [{ x: 0, y: 0, z: 0, radius: 45 }],
    tiers: [
      { radius: 24, inner: 12, north: true, y: 3 },
      { radius: 8, inner: 0, north: false, y: 6 },
    ],
    ramps: [30, 150],
    tower: { radius: 2, y: 6, height: 8 },
    pads: [{ pos: [0, 3, 13], target: [0, 0], lift: 12, speed: 8 }],
    moteSpots: [...ring(18, 34), ...ring(8, 18, { angle: 20, step: 20, y: 3 }), ...ring(4, 5, { angle: 45, y: 6 })],
    shadeSpots: ring(16, 43),
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    charmSpots: [[30, 0, 25], [-30, 0, 25]],
    shadeInterval: 360,
    shadeSpeed: 4.5,
    shadeLimit: 10,
    wind: true,
  },
};

export function groundHeight(world, x, z, ceiling = Infinity) {
  const radius = Math.hypot(x, z);
  for (let index = (world.tiers?.length ?? 0) - 1; index >= 0; index--) {
    const tier = world.tiers[index];
    if (tier.y <= ceiling && radius >= tier.inner && radius <= tier.radius && (!tier.north || z > 0)) return tier.y;
  }
  for (const angle of world.ramps ?? []) {
    const radians = angle * Math.PI / 180;
    const along = x * Math.cos(radians) + z * Math.sin(radians);
    const across = -x * Math.sin(radians) + z * Math.cos(radians);
    const height = Math.min(3, (30 - along) * 0.5);
    if (along >= 23.9 && along <= 30 && Math.abs(across) <= 1.5 && height <= ceiling) return height;
  }
  if (ceiling < 0) return -Infinity;
  const bridge = world.bridge;
  if (bridge && x >= bridge.minX && x <= bridge.maxX && z >= bridge.minZ && z <= bridge.maxZ) return 0;
  if (world.disks.some(disk => Math.hypot(x - disk.x, z - disk.z) <= disk.radius)) return 0;
  return -Infinity;
}

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
