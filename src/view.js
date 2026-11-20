import * as THREE from 'three';
import { groundHeight, HZ, seededRandom } from './world.js';

const palette = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a,
  wood: 0x6b4a2f, clouds: 0x12384a, active: 0xffb347, core: 0xffe9b0,
  inactive: 0x5b5f6e, mote: 0xfff6c2, halo: 0xffe58a,
  dark: 0x120a1a, violet: 0x7a3cff, accentBlue: 0x00b3ff, stunned: 0x3a3450,
  coat: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};
const cylinder = (top, bottom, height, segments = 12) => new THREE.CylinderGeometry(top, bottom, height, segments);
const sphere = (radius, width = 12, height = 8) => new THREE.SphereGeometry(radius, width, height);
const box = (width, height, depth) => new THREE.BoxGeometry(width, height, depth);
const lambert = color => new THREE.MeshLambertMaterial({ color });
const basic = color => new THREE.MeshBasicMaterial({ color });

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  group.add(item);
  return item;
}

function place(group, pos) {
  group.position.fromArray(pos);
  return group;
}

function createPlayer() {
  const player = new THREE.Group();
  mesh(player, cylinder(0.28, 0.43, 0.62), lambert(palette.coat), 0, 0.78);
  mesh(player, sphere(0.25), lambert(0xdcae87), 0, 1.25);
  mesh(player, cylinder(0.06, 0.57, 0.29), lambert(palette.sand), 0, 1.565);
  mesh(player, cylinder(0.50, 0.53, 0.035), lambert(palette.gold), 0, 1.435);
  mesh(player, cylinder(0.32, 0.31, 0.105), lambert(palette.scarf), 0, 1.073);
  mesh(player, box(0.14, 0.32, 0.075), lambert(palette.scarf), 0.2, 0.945, -0.28).rotation.z = -0.28;
  mesh(player, box(0.19, 0.43, 0.22), lambert(palette.dark), -0.18, 0.31).name = 'left-foot';
  mesh(player, box(0.19, 0.43, 0.22), lambert(palette.dark), 0.18, 0.31).name = 'right-foot';
  mesh(player, cylinder(0.018, 0.018, 0.32), lambert(palette.wood), 0.48, 1.24);
  mesh(player, cylinder(0.13, 0.095, 0.25, 6), basic(palette.core), 0.48, 0.985);
  return player;
}

function createLantern() {
  const group = new THREE.Group();
  mesh(group, cylinder(0.28, 0.45, 0.2), lambert(0x484257), 0, 0.1);
  mesh(group, cylinder(0.12, 0.2, 2.05, 8), lambert(palette.wood), 0, 1.02);
  mesh(group, cylinder(0.19, 0.27, 0.14, 6), lambert(palette.wood), 0, 2.08);
  const paper = new THREE.Group();
  paper.name = 'paper';
  paper.position.y = 2.12;
  group.add(paper);
  mesh(paper, cylinder(0.26, 0.3, 0.66, 6), basic(palette.inactive), 0, 0.33).name = 'lamp';
  mesh(paper, cylinder(0.12, 0.17, 0.19, 6), basic(palette.core), 0, 0.33, 0.25).name = 'core';
  mesh(paper, cylinder(0.075, 0.38, 0.24, 6), lambert(palette.wood), 0, 0.79);
  const tear = new THREE.Shape();
  tear.moveTo(-0.13, 0.17);
  tear.lineTo(0.025, 0.06);
  tear.lineTo(-0.002, -0.015);
  tear.lineTo(0.17, -0.19);
  tear.lineTo(-0.045, -0.064);
  tear.lineTo(-0.018, 0.028);
  tear.closePath();
  const tears = new THREE.Group();
  tears.name = 'tears';
  paper.add(tears);
  const tearGeometry = new THREE.ShapeGeometry(tear);
  const tearMaterial = basic(palette.dark);
  for (let side = 0; side < 6; side++) {
    const angle = (side + 0.5) * Math.PI / 3;
    const patch = mesh(tears, tearGeometry, tearMaterial, Math.sin(angle) * 0.257, 0.35, Math.cos(angle) * 0.257);
    patch.rotation.y = angle;
    patch.scale.x = 0.75;
  }
  const meter = new THREE.Group();
  meter.name = 'fuel-meter';
  meter.position.y = 3.36;
  group.add(meter);
  mesh(meter, new THREE.PlaneGeometry(1.25, 0.17), basic(palette.dark));
  mesh(meter, new THREE.PlaneGeometry(1.16, 0.085), basic(palette.gold), 0, 0, 0.005).name = 'fuel-level';
  const rim = new THREE.RingGeometry(0.985, 1.0, 36);
  const ring = mesh(group, rim, new THREE.MeshBasicMaterial({
    color: palette.active, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false,
  }), 0, 0.027);
  ring.rotation.x = -Math.PI / 2;
  ring.name = 'safety';
  return group;
}

const moteGeometry = new THREE.IcosahedronGeometry(0.16, 0);
const moteMaterial = basic(palette.mote);
const haloGeometry = new THREE.IcosahedronGeometry(0.28, 0);
const haloMaterial = new THREE.MeshBasicMaterial({ color: palette.halo, transparent: true, opacity: 0.17, depthWrite: false });
function createMote() {
  const group = new THREE.Group();
  mesh(group, moteGeometry, moteMaterial);
  mesh(group, haloGeometry, haloMaterial);
  return group;
}

function createShade() {
  const group = new THREE.Group();
  const body = mesh(group, sphere(0.67), lambert(palette.dark));
  body.name = 'body';
  body.scale.y = 1.12;
  const eyeMaterial = basic(palette.violet);
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: palette.violet, side: THREE.BackSide });
  const outline = mesh(group, sphere(0.705), outlineMaterial);
  outline.name = 'outline';
  outline.scale.y = 1.12;
  mesh(group, sphere(0.11), eyeMaterial, -0.2, 0.13, 0.59).name = 'eye';
  mesh(group, sphere(0.11), eyeMaterial, 0.2, 0.13, 0.59);
  const tail = mesh(group, cylinder(0.44, 0.06, 0.62), lambert(0x211039), 0, -0.62);
  tail.rotation.x = 0.4;
  return group;
}

function createDrifter() {
  const node = new THREE.Group();
  const satin = lambert(palette.drifter);
  for (let index = 0; index < 6; index++) {
    const segment = mesh(node, sphere(0.32 - index * 0.035, 7, 5), satin, 0, 0, -index * 0.27);
    segment.scale.set(1.3, 0.37, 0.72);
  }
  mesh(node, sphere(0.10, 8, 5), basic(palette.core), 0, 0.022, 0.23);
  return node;
}

function createCharm() {
  const node = new THREE.Group();
  mesh(node, box(0.47, 0.73, 0.055), basic(palette.gold));
  mesh(node, box(0.36, 0.61, 0.062), basic(palette.scarf));
  return node;
}

function elevatedDeck(tier) {
  if (!tier.north) return cylinder(tier.radius, tier.radius, 0.55, 48);
  const path = new THREE.Shape();
  path.absarc(0, 0, tier.radius, 0, -Math.PI, true);
  path.lineTo(-tier.inner, 0);
  path.absarc(0, 0, tier.inner, -Math.PI, 0, false);
  path.closePath();
  const geometry = new THREE.ExtrudeGeometry(path, { depth: tier.y, bevelEnabled: false, curveSegments: 32 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function disposeTree(group) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse(item => {
    if (item.geometry && item.geometry !== moteGeometry && item.geometry !== haloGeometry) geometries.add(item.geometry);
    if (item.material && item.material !== moteMaterial && item.material !== haloMaterial) materials.add(item.material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function createView(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.domElement.tabIndex = -1;
  stage.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.FogExp2(palette.fog, 0.0105);
  const camera = new THREE.PerspectiveCamera(64, 1, 0.15, 390);
  const moonlight = new THREE.DirectionalLight(0xd0d7ff, 1.22);
  moonlight.position.set(-25, 55, -15);
  const ambient = new THREE.HemisphereLight(0xffe9b0, 0x4a528f, 0.15);
  scene.add(moonlight, ambient);
  const player = createPlayer();
  scene.add(player);
  const shadow = mesh(scene, new THREE.CircleGeometry(0.58, 16),
    new THREE.MeshBasicMaterial({ color: 0x10172c, transparent: true, opacity: 0.5, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  const pulse = mesh(scene, new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({
    color: palette.active, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }));
  pulse.rotation.x = -Math.PI / 2;
  pulse.visible = false;
  let pulseTime = -Infinity;

  const sky = new THREE.Group();
  const random = seededRandom(403);
  const stars = Array.from({ length: 800 }, () => {
    const angle = random() * Math.PI * 2;
    const radius = 225 + random() * 90;
    return [Math.cos(angle) * radius, 10 + random() * 155, Math.sin(angle) * radius];
  }).flat();
  const starField = new THREE.BufferGeometry();
  starField.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  sky.add(new THREE.Points(starField, new THREE.PointsMaterial({ color: 0xe9e3cf, size: 0.65, fog: false })));
  mesh(sky, sphere(7, 24, 16), new THREE.MeshBasicMaterial({ color: palette.core, fog: false }), -145, 81, 170);
  const sea = mesh(sky, new THREE.PlaneGeometry(1200, 1200), basic(palette.clouds), 0, -15);
  sea.rotation.x = -Math.PI / 2;
  const cloudMaterial = basic(0x294a65);
  const cloudGeometry = sphere(1, 9, 6);
  for (let index = 0; index < 18; index++) {
    const cloud = mesh(sky, cloudGeometry, cloudMaterial, (random() - 0.5) * 220, -12 + random() * 3, (random() - 0.5) * 210);
    cloud.scale.set(7 + random() * 13, 1 + random() * 2, 3 + random() * 5);
  }
  scene.add(sky);

  let map = new THREE.Group();
  scene.add(map);
  const lanterns = new Map();
  const motes = new Map();
  const shades = new Map();
  const drifters = new Map();
  const charms = new Map();
  const leafField = new THREE.BufferGeometry();
  const leafPositions = new Float32Array(50 * 3);
  leafField.setAttribute('position', new THREE.BufferAttribute(leafPositions, 3));
  const airborneLeaves = new THREE.Points(leafField, new THREE.PointsMaterial({ color: palette.gold, size: 0.16 }));
  airborneLeaves.frustumCulled = false;
  scene.add(airborneLeaves);

  function sync(nodes, list, create, update) {
    const seen = new Set();
    for (const [index, entity] of list.entries()) {
      seen.add(entity.id);
      if (!nodes.has(entity.id)) {
        const node = create();
        nodes.set(entity.id, node);
        map.add(node);
      }
      update(nodes.get(entity.id), entity, index);
    }
    for (const [id, node] of nodes) {
      if (seen.has(id)) continue;
      nodes.delete(id);
      map.remove(node);
      disposeTree(node);
    }
  }

  function setWorld(game) {
    disposeTree(map);
    scene.remove(map);
    map = new THREE.Group();
    scene.add(map);
    for (const nodes of [lanterns, motes, shades, drifters, charms]) nodes.clear();
    const grass = lambert(palette.grass);
    const bank = lambert(0x253f4c);
    const sand = lambert(palette.sand);
    const wood = lambert(palette.wood);
    for (const disk of game.world.disks) {
      const { x, y, z, radius } = disk;
      mesh(map, cylinder(radius, radius, 0.32, 72), grass, x, y - 0.16, z);
      mesh(map, cylinder(radius, radius * 0.97, 0.46, 72), sand, x, y - 0.55, z);
      mesh(map, cylinder(radius * 0.97, radius * 0.68, 8, 32), bank, x, y - 4.76, z);
    }
    const bridge = game.world.bridge;
    if (bridge) {
      for (let x = bridge.minX + 0.21; x < bridge.maxX; x += 0.44) {
        mesh(map, box(0.41, 0.19, 4), x % 2 < 1 ? wood : sand, x, -0.095);
      }
      for (const z of [-1.85, 1.85]) mesh(map, box(18, 0.25, 0.12), wood, 35, -0.25, z);
    }
    for (const tier of game.world.tiers ?? []) {
      mesh(map, elevatedDeck(tier), grass, 0, tier.north ? 0 : tier.y - 0.275);
      if (!tier.north) {
        const pillar = cylinder(0.28, 0.39, tier.y - 0.55, 7);
        for (const [x, z] of [[-4, -4], [-4, 4], [4, -4], [4, 4]]) mesh(map, pillar, wood, x, (tier.y - 0.55) / 2, z);
      }
    }
    for (const degrees of game.world.ramps ?? []) {
      const angle = degrees * Math.PI / 180;
      const ramp = mesh(map, box(Math.hypot(6, 3), 0.14, 3), sand, 27 * Math.cos(angle), 1.46, 27 * Math.sin(angle));
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = -angle;
      ramp.rotation.z = -Math.atan2(3, 6);
    }
    for (const { pos } of game.world.pads ?? []) {
      mesh(map, cylinder(1, 1, 0.09), lambert(0x396d67), pos[0], pos[1] + 0.045, pos[2]);
      mesh(map, cylinder(0.5, 0.5, 0.11), basic(palette.gold), pos[0], pos[1] + 0.059, pos[2]);
    }
    const tower = game.world.tower;
    if (tower) {
      mesh(map, cylinder(1.8, tower.radius, 7, 12), wood, 0, tower.y + 3.5);
      mesh(map, cylinder(0.28, 2.58, 1.32, 8), lambert(0x254151), 0, tower.y + 7.42);
      for (let index = 0; index < 4; index++) {
        const angle = index * Math.PI / 2;
        const window = mesh(map, box(0.68, 1.33, 0.07), basic(palette.core),
          Math.sin(angle) * 1.85, tower.y + 5.8, Math.cos(angle) * 1.85);
        window.rotation.y = angle;
      }
    }
    const trees = seededRandom(20 + game.night);
    const trunk = cylinder(0.11, 0.24, 2.2, 6);
    const leaves = cylinder(0, 1.25, 3.05, 7);
    const foliage = lambert(0x28584e);
    const treePositions = [];
    for (const disk of game.world.disks.filter(item => item.y === 0)) {
      for (let index = 0; index < 28; index++) {
        const angle = trees() * Math.PI * 2;
        const radius = disk.radius * (0.80 + trees() * 0.17);
        const x = disk.x + Math.cos(angle) * radius;
        const z = disk.z + Math.sin(angle) * radius;
        if (game.lanterns.some(item => Math.hypot(x - item.pos[0], z - item.pos[2]) < 3)) continue;
        const size = 0.5 + trees() * 0.65;
        treePositions.push({ x, z, size });
      }
    }
    for (const [geometry, material, height] of [[trunk, wood, 1.1], [leaves, foliage, 3.18]]) {
      const instanced = new THREE.InstancedMesh(geometry, material, treePositions.length);
      const pivot = new THREE.Object3D();
      treePositions.forEach(({ x, z, size }, index) => {
        pivot.position.set(x, size * height, z);
        pivot.scale.setScalar(size);
        pivot.updateMatrix();
        instanced.setMatrixAt(index, pivot.matrix);
      });
      map.add(instanced);
    }
    pulse.visible = false;
    pulseTime = -Infinity;
  }

  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(game, yaw, pitch, time, menu, distinctColors) {
    const p = game.player;
    const visibleTime = game.simTick / HZ;
    const angle = (menu ? -28 + Math.sin(time * 0.22) * 16 : yaw) * Math.PI / 180;
    const distance = menu ? 25 : 8.8 * Math.cos(pitch);
    camera.position.set(p.pos[0] - Math.sin(angle) * distance, p.pos[1] + (menu ? 16 : 2.7 + Math.sin(pitch) * 9), p.pos[2] - Math.cos(angle) * distance);
    camera.lookAt(p.pos[0] + Math.sin(angle) * 4, p.pos[1] + 1.1, p.pos[2] + Math.cos(angle) * 4);
    place(player, p.pos);
    player.visible = !(p.invuln > game.simTick && Math.floor(visibleTime * 14) % 2);
    player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    const feet = Math.sin(visibleTime * 15) * Math.min(0.72, Math.hypot(p.vel[0], p.vel[2]) * 0.15);
    player.getObjectByName('left-foot').rotation.x = feet;
    player.getObjectByName('right-foot').rotation.x = -feet;
    const floor = groundHeight(game.world, p.pos[0], p.pos[2], p.pos[1] + 0.01);
    shadow.visible = Number.isFinite(floor) && p.pos[1] >= floor;
    shadow.position.set(p.pos[0], shadow.visible ? floor + 0.025 : 0, p.pos[2]);
    ambient.intensity = 0.15 + 0.55 * game.litCount / game.lanterns.length;
    sync(lanterns, game.lanterns, createLantern, (node, item) => {
      place(node, item.pos);
      const weak = game.isWeak(item);
      const bright = item.lit && (!weak || game.simTick % HZ < HZ / 2);
      node.getObjectByName('paper').scale.y = item.lit ? 1 : 0.8;
      node.getObjectByName('lamp').material.color.setHex(bright ? palette.active : item.lit ? 0x98704b : palette.inactive);
      node.getObjectByName('core').visible = bright;
      node.getObjectByName('tears').visible = !item.lit;
      const meter = node.getObjectByName('fuel-meter');
      meter.visible = item.lit;
      meter.quaternion.copy(camera.quaternion);
      const level = meter.getObjectByName('fuel-level');
      const ratio = item.fuelUnits / game.maxFuelUnits;
      level.scale.x = ratio;
      level.position.x = (ratio - 1) * 0.58;
      level.material.color.setHex(bright ? palette.gold : 0x735c38);
      const ring = node.getObjectByName('safety');
      ring.visible = game.isSafe(item);
      ring.scale.setScalar(game.tuning.safe_radius);
    });
    sync(motes, game.motes, createMote, (node, item, index) => {
      place(node, item.pos);
      node.position.y += 0.65 + Math.sin(visibleTime * 4 + index * 0.71) * 0.22;
      node.rotation.y = visibleTime * 1.35 + index;
    });
    sync(shades, game.shades, createShade, (node, item, index) => {
      place(node, item.pos);
      node.position.y += Math.sin(visibleTime * 5 + index) * 0.12;
      node.rotation.y = Math.atan2(p.pos[0] - item.pos[0], p.pos[2] - item.pos[2]);
      node.getObjectByName('body').material.color.setHex(item.state === 'stunned' ? palette.stunned : palette.dark);
      const accent = distinctColors ? palette.accentBlue : palette.violet;
      node.getObjectByName('eye').material.color.setHex(accent);
      node.getObjectByName('outline').material.color.setHex(accent);
    });
    sync(drifters, game.drifters, createDrifter, (node, item, index) => {
      place(node, item.pos);
      node.position.y += Math.sin(visibleTime * 5 + index) * 0.2;
      node.rotation.y = Math.atan2(p.pos[0] - item.pos[0], p.pos[2] - item.pos[2]) +
        (item.state === 'flee' ? Math.PI : 0);
      node.rotation.z = Math.sin(visibleTime * 8 + index) * 0.42;
    });
    sync(charms, game.charms, createCharm, (node, item) => {
      place(node, item.pos);
      node.position.y += 0.8 + Math.sin(visibleTime * 4) * 0.1;
      node.rotation.y = visibleTime * 1.6;
      node.visible = item.available;
    });
    airborneLeaves.visible = game.windEnabled && (game.wind.active || game.simTick % 1800 >= 1680);
    if (airborneLeaves.visible) {
      for (let index = 0; index < 50; index++) {
        leafPositions[index * 3] = p.pos[0] + (index * 1.73 + visibleTime * 8) % 34 - 17;
        leafPositions[index * 3 + 1] = p.pos[1] + 0.6 + (index * 0.37) % 4 + Math.sin(visibleTime * 3 + index) * 0.4;
        leafPositions[index * 3 + 2] = p.pos[2] + (index * 7.41) % 30 - 15;
      }
      leafField.attributes.position.needsUpdate = true;
    }
    pulse.visible = visibleTime - pulseTime < 0.44;
    if (pulse.visible) {
      const elapsed = Math.max(0.05, (visibleTime - pulseTime) / 0.44);
      pulse.scale.setScalar(elapsed * game.tuning.pulse_radius);
      pulse.material.opacity = Math.max(0, 0.85 * (1 - elapsed));
    }
    renderer.render(scene, camera);
  }

  return {
    setWorld, draw,
    canvas: renderer.domElement,
    project(pos) {
      const vector = new THREE.Vector3(...pos);
      const local = vector.clone().applyMatrix4(camera.matrixWorldInverse);
      vector.project(camera);
      return { x: vector.x, y: vector.y, behind: local.z >= 0 };
    },
    flash(game) {
      pulseTime = game.simTick / 60;
      pulse.position.set(game.player.pos[0], game.player.pos[1] + 0.08, game.player.pos[2]);
    },
  };
}
