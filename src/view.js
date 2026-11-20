import * as THREE from 'three';
import { seededRandom } from './world.js';

const palette = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a,
  wood: 0x6b4a2f, clouds: 0x12384a, active: 0xffb347, core: 0xffe9b0,
  inactive: 0x5b5f6e, mote: 0xfff6c2, halo: 0xffe58a,
  dark: 0x120a1a, violet: 0x7a3cff, stunned: 0x3a3450,
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
  mesh(group, cylinder(0.26, 0.3, 0.66, 6), basic(palette.inactive), 0, 2.45).name = 'lamp';
  mesh(group, cylinder(0.075, 0.38, 0.24, 6), lambert(palette.wood), 0, 2.91);
  const rim = new THREE.RingGeometry(1.02, 1.09, 36);
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
  mesh(group, sphere(0.11), eyeMaterial, -0.2, 0.13, 0.59);
  mesh(group, sphere(0.11), eyeMaterial, 0.2, 0.13, 0.59);
  const tail = mesh(group, cylinder(0.44, 0.06, 0.62), lambert(0x211039), 0, -0.62);
  tail.rotation.x = 0.4;
  return group;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0x3a5775, transparent: true, opacity: 0.42, depthWrite: false });
  const cloudGeometry = sphere(1, 9, 6);
  for (let index = 0; index < 53; index++) {
    const cloud = mesh(sky, cloudGeometry, cloudMaterial, (random() - 0.5) * 220, -12 + random() * 3, (random() - 0.5) * 210);
    cloud.scale.set(7 + random() * 13, 1 + random() * 2, 3 + random() * 5);
  }
  scene.add(sky);

  let map = new THREE.Group();
  scene.add(map);
  const lanterns = new Map();
  const motes = new Map();
  const shades = new Map();

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
    for (const nodes of [lanterns, motes, shades]) nodes.clear();
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
    const trees = seededRandom(20 + game.night);
    const trunk = cylinder(0.11, 0.24, 2.2, 6);
    const leaves = cylinder(0, 1.25, 3.05, 7);
    const foliage = lambert(0x28584e);
    for (const disk of game.world.disks.filter(item => item.y === 0)) {
      for (let index = 0; index < 28; index++) {
        const angle = trees() * Math.PI * 2;
        const radius = disk.radius * (0.80 + trees() * 0.17);
        const x = disk.x + Math.cos(angle) * radius;
        const z = disk.z + Math.sin(angle) * radius;
        if (game.lanterns.some(item => Math.hypot(x - item.pos[0], z - item.pos[2]) < 3)) continue;
        const size = 0.5 + trees() * 0.65;
        mesh(map, trunk, wood, x, size * 1.1, z).scale.setScalar(size);
        mesh(map, leaves, foliage, x, size * 3.18, z).scale.setScalar(size);
      }
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

  function draw(game, yaw, pitch, time, menu) {
    const p = game.player;
    const visibleTime = game.simTick / 60;
    place(player, p.pos);
    player.visible = !(p.invuln > game.simTick && Math.floor(visibleTime * 14) % 2);
    player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    const feet = Math.sin(visibleTime * 15) * Math.min(0.72, Math.hypot(p.vel[0], p.vel[2]) * 0.15);
    player.getObjectByName('left-foot').rotation.x = feet;
    player.getObjectByName('right-foot').rotation.x = -feet;
    shadow.position.set(p.pos[0], 0.025, p.pos[2]);
    ambient.intensity = 0.15 + 0.55 * game.lanterns.filter(item => item.lit).length / game.lanterns.length;
    sync(lanterns, game.lanterns, createLantern, (node, item) => {
      place(node, item.pos);
      node.getObjectByName('lamp').material.color.setHex(item.lit ? palette.active : palette.inactive);
      const ring = node.getObjectByName('safety');
      ring.visible = item.lit;
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
    });
    pulse.visible = visibleTime - pulseTime < 0.44;
    if (pulse.visible) {
      const elapsed = Math.max(0.05, (visibleTime - pulseTime) / 0.44);
      pulse.scale.setScalar(elapsed * game.tuning.pulse_radius);
      pulse.material.opacity = Math.max(0, 0.85 * (1 - elapsed));
    }
    const angle = (menu ? -28 + Math.sin(time * 0.22) * 16 : yaw) * Math.PI / 180;
    const distance = menu ? 25 : 8.8 * Math.cos(pitch);
    camera.position.set(p.pos[0] - Math.sin(angle) * distance, p.pos[1] + (menu ? 16 : 2.7 + Math.sin(pitch) * 9), p.pos[2] - Math.cos(angle) * distance);
    camera.lookAt(p.pos[0] + Math.sin(angle) * 4, p.pos[1] + 1.1, p.pos[2] + Math.cos(angle) * 4);
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
