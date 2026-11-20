import { DT, HZ, direction, groundHeight, horizontalDistance, inputDirection, seededRandom, worlds } from './world.js';

export const buttons = ['jump', 'interact', 'pulse', 'dash', 'pause'];
export const blankInput = { move: [0, 0], cam_yaw_deg: 0, ...Object.fromEntries(buttons.map(button => [button, false])) };
export const shadeStates = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
export const drifterStates = ['idle', 'chase', 'flee', 'removed'];

const ticks = seconds => Math.round((seconds ?? 0) * HZ);
const round = value => Math.round(value * 1000) / 1000 || 0;
const byId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });
const left = (end, tick) => Math.max(0, end - tick);
const DRIFT_SPEED = 7;
const CHARM_DURATION = 600;
const CHARM_RESPAWN = 2700;
const JUMP_SPEED = 7;
const GRAVITY = 20;
const FALL_FLOOR = -10;
const RESPAWN_DELAY = 60;
const DROP_TTL = 480;
const DRAIN_RADIUS = 2;
const DRAIN_DETECT_RADIUS = 6;
const EPSILON = 1e-8;
const displayFuel = units => Math.round(units * 10 / HZ) / 10;

function withinDisk(x, z, radius) {
  return Math.hypot(x, z) < radius - EPSILON;
}

export class Game {
  constructor(contract, { seed = 0, night = 1, scenario = {} } = {}) {
    this.tuning = contract.tuning;
    this.maxFuelUnits = ticks(this.tuning.fuel_max);
    this.safeFuelUnits = ticks(this.tuning.low_fuel_threshold);
    this.refuelUnits = ticks(this.tuning.fuel_per_mote);
    this.night = night;
    this.world = worlds[night];
    this.random = seededRandom(seed);
    this.events = [];
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.startTime = scenario.time_left_s ?? this.tuning['night' + night + '_duration_s'];
    this.timeLeft = this.startTime;
    this.score = 0;
    this.previousInput = blankInput;

    const initial = scenario.player ?? {};
    this.player = {
      pos: [...(initial.pos ?? [0, 0, 0])],
      vel: [0, 0, 0],
      grounded: false,
      facing: [0, 1],
      carried: initial.carried ?? 0,
      successfulLights: initial.successful_lights ?? 0,
      flames: initial.flames ?? this.tuning.flames,
      invuln: initial.invuln_ticks ?? 0,
      pulseCooldown: initial.pulse_cd_ticks ?? 0,
      dashCooldown: initial.dash_cd_ticks ?? 0,
      charmEnd: initial.charm_ticks ?? 0,
      dashRemaining: 0,
      dashDirection: [0, 1],
      launch: null,
      respawnAt: null,
    };
    const [x, y, z] = this.player.pos;
    this.player.grounded = Math.abs(groundHeight(this.world, x, z, y + EPSILON) - y) < EPSILON;

    this.ids = { M: 0, S: 0, D: 0, C: 0 };
    const changes = new Map((scenario.lanterns ?? []).map(item => [item.id, item]));
    this.lanterns = this.world.lanterns.map((pos, index) => {
      const id = 'L' + (index + 1);
      const item = changes.get(id) ?? {};
      const cost = item.ever_lit ? this.tuning.relight_cost : this.tuning.lantern_cost;
      const deposited = item.deposited ?? (item.lit ? cost : 0);
      const lit = item.lit ?? (deposited >= cost);
      return {
        id, pos: [...(item.pos ?? pos)], deposited, lit,
        fuelUnits: lit ? ticks(item.fuel ?? this.tuning.fuel_max) : 0,
        everLit: lit || (item.ever_lit ?? false), relitCount: 0,
      };
    });
    this.lanternById = new Map(this.lanterns.map(lantern => [lantern.id, lantern]));
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.randomDrifters = scenario.random_drifters ?? this.night >= 2;
    this.windEnabled = (scenario.wind_enabled ?? true) && Boolean(this.world.wind);
    this.wind = { active: false, dir_deg: 0 };
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    const initialShades = scenario.shades ?? [];
    const initialDrifters = scenario.drifters ?? [];
    for (const item of initialShades) if (item.id !== undefined) this.makeId('S', item.id);
    for (const item of initialDrifters) if (item.id !== undefined) this.makeId('D', item.id);
    if (scenario.motes) {
      for (const pos of scenario.motes) this.addMote(pos);
    } else if (this.randomMotes) {
      for (let index = 0; index < 20; index++) this.spawnMote();
    }
    for (const item of initialShades) this.addShade(item);
    for (const item of initialDrifters) this.addDrifter(item);
    const charmSpots = this.world.charmSpots ?? [];
    const initialCharms = scenario.charms ?? charmSpots.map((pos, index) => ({ id: 'C' + (index + 1), pos }));
    this.charms = initialCharms.map((item, index) => {
      const id = item.id ?? 'C' + (index + 1);
      const spot = /^C\d+$/.test(id) ? charmSpots[Number(id.slice(1)) - 1] : undefined;
      const respawnAt = item.respawn_ticks ?? item.respawn_ticks_left ?? 0;
      const available = item.available ?? respawnAt === 0;
      return { id, pos: [...(item.pos ?? spot ?? [0, 0, 0])], available, respawnAt: available ? 0 : respawnAt || CHARM_RESPAWN };
    });
  }

  emit(name, data = {}) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  makeId(prefix, supplied) {
    if (supplied === undefined) return prefix + ++this.ids[prefix];
    const suffix = supplied.startsWith(prefix) && /^\d+$/.test(supplied.slice(1)) ? Number(supplied.slice(1)) : 0;
    if (Number.isSafeInteger(suffix)) this.ids[prefix] = Math.max(this.ids[prefix], suffix);
    return supplied;
  }

  choose(items) {
    return items[Math.floor(this.random() * items.length)];
  }

  addMote(pos, kind = 'random', ttl = null, spot = null) {
    this.motes.push({ id: this.makeId('M'), pos: [...pos], kind, ttl, spot, available: this.simTick + 1 });
  }

  spawnMote() {
    if (this.motes.length >= 30) return;
    const occupied = new Set(this.motes.map(mote => mote.spot).filter(spot => spot !== null));
    this.world.moteSpots.forEach((pos, index) => {
      if (this.motes.some(mote => mote.pos.every((component, axis) => Math.abs(component - pos[axis]) < 1e-6))) occupied.add(index);
    });
    const spot = this.choose(this.world.moteSpots.map((_, index) => index).filter(index => !occupied.has(index)));
    if (spot !== undefined) this.addMote(this.world.moteSpots[spot], 'random', null, spot);
  }

  addShade({ id, pos, state = 'wander', state_ticks_left, target_lantern_id }) {
    const durations = { spawning: 1, recoil: 60, stunned: 120 };
    const shade = {
      id: this.makeId('S', id), pos: [...pos], state,
      stateEnd: this.simTick + (state_ticks_left ?? durations[state] ?? 0),
      pushLeft: 0, push: [0, 0], exit: null,
      targetLanternId: target_lantern_id ?? (state === 'drain' ? this.closestLantern(pos,
        lantern => this.isWeak(lantern) && horizontalDistance(pos, lantern.pos) <= DRAIN_RADIUS + EPSILON)?.id : undefined),
      drainSteps: 0,
      heading: this.random() * Math.PI * 2,
    };
    this.shades.push(shade);
    return shade;
  }

  spawnShades() {
    const candidates = this.world.shadeSpots.filter(pos =>
      horizontalDistance(pos, this.player.pos) >= 15 && !this.insideSafeZone(pos) &&
      !this.shades.some(shade => horizontalDistance(shade.pos, pos) < 1));
    const count = this.simTick === 300 ? 2 : 1;
    for (let index = 0; index < count && candidates.length && this.shades.length < this.world.shadeLimit; index++) {
      const [spot] = candidates.splice(Math.floor(this.random() * candidates.length), 1);
      const shade = this.addShade({ pos: [spot[0], spot[1] + 0.8, spot[2]], state: 'spawning' });
      this.emit('shade_spawned', { id: shade.id });
    }
  }

  addDrifter({ id, pos, state = 'idle', stolen = 0, state_ticks_left }) {
    this.drifters.push({
      id: this.makeId('D', id), pos: [...pos], state, stolen,
      stateEnd: this.simTick + (state_ticks_left ?? (state === 'flee' ? 240 : 0)),
      heading: this.random() * Math.PI * 2,
    });
  }

  spawnDrifter() {
    if (this.drifters.length >= 2) return;
    const [x, y, z] = this.choose(this.world.shadeSpots);
    this.addDrifter({ pos: [x, y + 1.2, z] });
  }

  step(input = blankInput) {
    this.events = [];
    if (this.state === 'won' || this.state === 'lost') return this.events;
    this.tick++;
    const pressed = button => input[button] && !this.previousInput[button];
    const actions = { pause: pressed('pause'), jump: pressed('jump'), dash: pressed('dash'),
      interact: pressed('interact'), pulse: pressed('pulse') };
    this.previousInput = { ...input };
    if (actions.pause) this.togglePause();
    if (this.state === 'paused') return this.events;

    this.simTick++;
    this.timeLeft = Math.max(0, this.startTime - this.simTick / HZ);
    if (this.simTick === 1) this.emit('night_start', { night: this.night });
    this.updateTimers();
    this.updateFuel();
    this.movePlayer(input, actions);
    if (this.player.respawnAt === null) {
      this.pickMotes();
      this.pickCharms();
      if (actions.interact) this.deposit();
    }
    this.updateSafeZones();
    if (this.player.respawnAt === null && actions.pulse) this.pulse();
    this.updateShades();
    this.updateDrifters();
    this.checkSteals();
    this.checkHits();
    if (this.randomMotes && this.simTick % 240 === 0) this.spawnMote();
    if (this.randomShades && this.simTick >= 300 && (this.simTick - 300) % this.world.shadeInterval === 0) this.spawnShades();
    if (this.randomDrifters && this.simTick % 1200 === 0) this.spawnDrifter();
    this.checkEnd();
    return this.events;
  }

  togglePause() {
    const paused = this.state === 'playing';
    this.state = paused ? 'paused' : 'playing';
    this.emit(paused ? 'paused' : 'resumed');
  }

  updateTimers() {
    this.motes = this.motes.filter(mote => mote.ttl === null || mote.ttl > this.simTick);
    for (const charm of this.charms) {
      if (!charm.available && charm.respawnAt <= this.simTick) charm.available = true;
    }
    if (!this.windEnabled) return;
    const cycle = this.simTick % 1800;
    if (cycle === 0) this.wind.dir_deg = this.random() * 360;
    this.wind.active = this.simTick >= 1800 && cycle < 300;
  }

  updateFuel() {
    const drains = new Map();
    const reports = [];
    for (const shade of this.shades) {
      if (shade.state !== 'drain') continue;
      const lantern = this.drainTarget(shade);
      if (!lantern) continue;
      drains.set(lantern, (drains.get(lantern) ?? 0) + this.tuning.drain_per_s);
      if (++shade.drainSteps % HZ === 0) reports.push({ lantern, shade });
    }
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      lantern.fuelUnits = Math.max(0, lantern.fuelUnits - this.tuning.fuel_decay_per_s - (drains.get(lantern) ?? 0));
    }
    for (const { lantern, shade } of reports) {
      this.emit('fuel_drain', { lantern_id: lantern.id, shade_id: shade.id, fuel: displayFuel(lantern.fuelUnits) });
    }
    for (const lantern of this.lanterns) {
      if (!lantern.lit || lantern.fuelUnits > 0) continue;
      lantern.lit = false;
      lantern.deposited = 0;
      this.emit('lantern_out', { lantern_id: lantern.id });
    }
  }

  movePlayer(input, actions) {
    const player = this.player;
    if (player.respawnAt !== null) {
      if (this.simTick < player.respawnAt || player.flames <= 0) return;
      Object.assign(player, {
        pos: [0, 0, 0], vel: [0, 0, 0], facing: [0, 1], grounded: true, launch: null,
        invuln: this.simTick + ticks(this.tuning.invuln_s), respawnAt: null,
      });
      return;
    }
    if (player.pos[1] < FALL_FLOOR) {
      this.fall();
      return;
    }

    const [x, z] = inputDirection(input.move, input.cam_yaw_deg);
    if (x || z) player.facing = direction(x, z);
    const charmed = player.charmEnd > this.simTick;
    if (actions.dash && !player.dashRemaining && (charmed || player.dashCooldown <= this.simTick)) {
      player.dashRemaining = ticks(this.tuning.dash_duration_s);
      player.dashDirection = player.facing;
      player.dashCooldown = charmed ? 0 : this.simTick + ticks(this.tuning.dash_cooldown_s);
      this.emit('dash');
    }
    if (actions.jump && player.grounded && !player.launch) {
      player.vel[1] = JUMP_SPEED;
      player.grounded = false;
    }

    const speed = charmed ? 7.2 : this.tuning.player_speed;
    const dashing = player.dashRemaining > 0;
    const [vx, vz] = dashing ? player.dashDirection.map(axis => axis * this.tuning.dash_speed)
      : player.launch ?? [x * speed, z * speed];
    const wind = this.wind.dir_deg * Math.PI / 180;
    player.vel[0] = vx + (this.wind.active ? 2 * Math.cos(wind) : 0);
    player.vel[2] = vz + (this.wind.active ? 2 * Math.sin(wind) : 0);
    this.resolveTerrain(dashing && !player.grounded);
    player.dashRemaining = Math.max(0, player.dashRemaining - 1);

    if (player.pos[1] < FALL_FLOOR) {
      this.fall();
      return;
    }
    const pad = player.grounded && this.world.pads?.find(item =>
      horizontalDistance(item.pos, player.pos) <= 1 && Math.abs(item.pos[1] - player.pos[1]) < EPSILON);
    if (pad) {
      player.launch = direction(pad.target[0] - pad.pos[0], pad.target[1] - pad.pos[2]).map(axis => axis * pad.speed);
      player.vel[1] = pad.lift;
      player.grounded = false;
    }
  }

  resolveTerrain(holdAltitude) {
    const player = this.player;
    const [x, y, z] = player.pos;
    const current = groundHeight(this.world, x, z);
    let nx = x + player.vel[0] * DT;
    let nz = z + player.vel[2] * DT;
    const nextTop = groundHeight(this.world, nx, nz);
    let nextY = y;
    if (!player.grounded && !holdAltitude) nextY += player.vel[1] * DT - GRAVITY * DT * DT / 2;

    const walkableRise = player.grounded && nextTop - y <= 0.22;
    const wall = nextTop > Math.max(y, nextY) + EPSILON && nextTop > current + EPSILON && !walkableRise;
    const tower = this.world.tower;
    const towerWall = tower && withinDisk(nx, nz, tower.radius) && !withinDisk(x, z, tower.radius) &&
      nextY < tower.y + tower.height && nextY >= tower.y - EPSILON;
    if (wall || towerWall) {
      nx = x;
      nz = z;
      player.vel[0] = 0;
      player.vel[2] = 0;
    }

    const surface = groundHeight(this.world, nx, nz, y + (player.grounded ? 0.22 : EPSILON));
    const walking = player.grounded && surface >= y - 0.22 && surface <= y + 0.22;
    const landing = !player.grounded && player.vel[1] <= 0 && surface <= y + EPSILON && nextY <= surface + EPSILON;
    if (walking || landing) {
      nextY = surface;
      player.vel[1] = 0;
      player.grounded = true;
      player.launch = null;
    } else {
      if (player.grounded && !holdAltitude) nextY -= GRAVITY * DT * DT / 2;
      player.grounded = false;
      if (!holdAltitude) player.vel[1] -= GRAVITY * DT;
    }
    player.pos = [nx, nextY, nz];
  }

  fall() {
    const player = this.player;
    const lost = player.carried;
    player.flames--;
    player.carried = 0;
    player.vel = [0, 0, 0];
    player.dashRemaining = 0;
    player.launch = null;
    player.respawnAt = this.simTick + RESPAWN_DELAY;
    this.emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost });
  }

  canPick(pos) {
    return horizontalDistance(this.player.pos, pos) <= this.tuning.pickup_radius + EPSILON &&
      Math.abs(this.player.pos[1] - pos[1]) <= 1.5 + EPSILON;
  }

  pickMotes() {
    const capacity = this.capacity;
    this.motes = this.motes.filter(mote => {
      if (mote.available > this.simTick || this.player.carried >= capacity || !this.canPick(mote.pos)) return true;
      this.player.carried++;
      this.emit('mote_picked', { carried: this.player.carried });
      return false;
    });
  }

  pickCharms() {
    for (const charm of this.charms) {
      if (!charm.available || !this.canPick(charm.pos)) continue;
      charm.available = false;
      charm.respawnAt = this.simTick + CHARM_RESPAWN;
      this.player.charmEnd = this.simTick + CHARM_DURATION;
      this.player.dashCooldown = 0;
      this.emit('charm_picked', { charm_id: charm.id, charm_ticks: CHARM_DURATION });
    }
  }

  get capacity() {
    return Math.min(this.tuning.capacity_max, this.tuning.carry_capacity + 2 * this.player.successfulLights);
  }

  get dawnTarget() {
    return Math.ceil(this.tuning.win_ratio * this.lanterns.length);
  }

  get litCount() {
    return this.lanterns.reduce((count, lamp) => count + Number(lamp.lit), 0);
  }

  closestLantern(pos, accepts, limit = Infinity) {
    let closest;
    let distance = limit;
    for (const lamp of this.lanterns) {
      if (!accepts(lamp)) continue;
      const next = horizontalDistance(pos, lamp.pos);
      if (next > distance + EPSILON) continue;
      if (!closest || next < distance - EPSILON || byId(lamp, closest) < 0) {
        closest = lamp;
        distance = next;
      }
    }
    return closest;
  }

  lanternCost(lantern) {
    return lantern.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
  }

  nearbyLantern() {
    return this.closestLantern(this.player.pos,
      lamp => lamp.lit ? lamp.fuelUnits < this.maxFuelUnits : lamp.deposited < this.lanternCost(lamp),
      this.tuning.interact_radius);
  }

  deposit() {
    const lantern = this.nearbyLantern();
    if (!lantern || this.player.carried <= 0) return;
    const cost = this.lanternCost(lantern);
    const needed = lantern.lit ? Math.ceil((this.maxFuelUnits - lantern.fuelUnits) / this.refuelUnits)
      : cost - lantern.deposited;
    const amount = Math.min(this.player.carried, needed);
    this.player.carried -= amount;
    this.score += amount * this.tuning.score.per_mote;
    if (lantern.lit) {
      lantern.fuelUnits = Math.min(this.maxFuelUnits, lantern.fuelUnits + this.refuelUnits * amount);
      this.emit('refuel', { lantern_id: lantern.id, amount, fuel: displayFuel(lantern.fuelUnits) });
      return;
    }
    lantern.deposited += amount;
    this.emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited < cost) return;
    const relight = lantern.everLit;
    lantern.lit = true;
    lantern.everLit = true;
    lantern.fuelUnits = this.maxFuelUnits;
    if (relight) lantern.relitCount++;
    this.player.successfulLights++;
    this.score += relight ? this.tuning.score.per_relight : this.tuning.score.per_lantern;
    this.emit('lantern_lit', { lantern_id: lantern.id, relight });
  }

  isWeak(lantern) {
    return lantern.lit && lantern.fuelUnits < this.safeFuelUnits;
  }

  isSafe(lantern) {
    return lantern.lit && lantern.fuelUnits >= this.safeFuelUnits;
  }

  drainTarget(shade) {
    const lantern = this.lanternById.get(shade.targetLanternId);
    return lantern && this.isWeak(lantern) && horizontalDistance(shade.pos, lantern.pos) <= DRAIN_RADIUS + EPSILON
      ? lantern : undefined;
  }

  stopDraining(shade) {
    shade.state = 'wander';
    shade.targetLanternId = undefined;
    shade.drainSteps = 0;
  }

  insideSafeZone(pos) {
    return this.lanterns.find(item => this.isSafe(item) && horizontalDistance(pos, item.pos) < this.tuning.safe_radius - EPSILON);
  }

  updateSafeZones() {
    for (const shade of this.shades) {
      if (shade.exit) continue;
      const lantern = this.insideSafeZone(shade.pos);
      if (!lantern) continue;
      const [dx, dz] = direction(shade.pos[0] - lantern.pos[0], shade.pos[2] - lantern.pos[2], [1, 0]);
      shade.exit = { target: [lantern.pos[0] + dx * this.tuning.safe_radius, lantern.pos[2] + dz * this.tuning.safe_radius], remaining: 30 };
    }
  }

  pulse() {
    const player = this.player;
    if (player.carried < this.tuning.pulse_cost || this.simTick < player.pulseCooldown) return;
    player.carried -= this.tuning.pulse_cost;
    player.pulseCooldown = this.simTick + ticks(this.tuning.pulse_cooldown_s);
    const withinPulse = ({ pos }) => Math.hypot(pos[0] - player.pos[0], pos[1] - player.pos[1] - 0.8, pos[2] - player.pos[2]) <= this.tuning.pulse_radius + EPSILON;
    const targets = this.shades.filter(withinPulse).sort(byId);
    for (const shade of targets) {
      this.score += shade.state === 'drain' ? this.tuning.score.per_drain_stun : this.tuning.score.per_stun;
      if (shade.state === 'drain') this.stopDraining(shade);
      shade.state = 'stunned';
      shade.stateEnd = this.simTick + ticks(this.tuning.pulse_stun_s);
      shade.pushLeft = 15;
      shade.push = direction(shade.pos[0] - player.pos[0], shade.pos[2] - player.pos[2], [1, 0]);
    }
    for (const drifter of this.drifters.filter(withinPulse).sort(byId)) {
      if (drifter.state === 'chase') this.flee(drifter, 0);
      else if (drifter.state === 'flee' && drifter.stolen) {
        const amount = drifter.stolen;
        this.dropMotes(amount, drifter.pos, true);
        this.flee(drifter, 0, 120);
        this.emit('drifter_drop', { drifter_id: drifter.id, amount });
      }
    }
    this.emit('pulse', { stunned_ids: targets.map(shade => shade.id) });
  }

  moveShade(shade, x, z, delta) {
    const start = shade.pos;
    let nx = start[0] + x * delta;
    let nz = start[2] + z * delta;
    const protectedBy = this.insideSafeZone([nx, start[1], nz]);
    if (protectedBy) {
      const dx = nx - start[0];
      const dz = nz - start[2];
      const ox = start[0] - protectedBy.pos[0];
      const oz = start[2] - protectedBy.pos[2];
      const a = dx * dx + dz * dz;
      const b = ox * dx + oz * dz;
      const c = ox * ox + oz * oz - this.tuning.safe_radius ** 2;
      const t = a ? Math.max(0, Math.min(1, (-b - Math.sqrt(Math.max(0, b * b - a * c))) / a)) : 0;
      nx = start[0] + dx * t;
      nz = start[2] + dz * t;
    }
    const ceiling = start[1] + 0.25;
    const from = groundHeight(this.world, start[0], start[2], ceiling);
    const to = groundHeight(this.world, nx, nz, ceiling);
    const wall = groundHeight(this.world, nx, nz) > Math.max(ceiling, groundHeight(this.world, start[0], start[2])) + EPSILON;
    if (!Number.isFinite(to) || !Number.isFinite(from) || wall || Math.abs(to - from) > 0.25 ||
        (this.world.tower && withinDisk(nx, nz, this.world.tower.radius))) return false;
    shade.pos = [nx, start[1] + to - from, nz];
    return !protectedBy;
  }

  updateShades() {
    for (const shade of this.shades) {
      const leftDrain = shade.state === 'drain' && !this.drainTarget(shade);
      if (leftDrain) this.stopDraining(shade);
      const recovered = shade.state === 'stunned' && shade.stateEnd <= this.simTick;
      if (recovered) {
        shade.state = 'wander';
        shade.pushLeft = 0;
      }
      if (shade.exit) {
        const { target, remaining } = shade.exit;
        shade.pos[0] += (target[0] - shade.pos[0]) / remaining;
        shade.pos[2] += (target[1] - shade.pos[2]) / remaining;
        if (--shade.exit.remaining === 0) shade.exit = null;
        continue;
      }
      if (leftDrain || recovered) continue;
      if (shade.stateEnd > this.simTick) {
        if (shade.state === 'stunned' && shade.pushLeft > 0) {
          if (this.moveShade(shade, ...shade.push, this.tuning.pulse_push_m / 15)) shade.pushLeft--;
          else shade.pushLeft = 0;
        } else if (shade.state === 'recoil') this.moveShade(shade, ...shade.push, 2 / 60);
        continue;
      }
      const [x, , z] = this.player.pos;
      const distance = horizontalDistance(shade.pos, this.player.pos);
      const speed = this.world.shadeSpeed ?? this.tuning.shade_speed;
      const detectionRadius = shade.state === 'drain' ? DRAIN_DETECT_RADIUS : shade.state === 'chase' ? 18 : 12;
      if (this.player.respawnAt === null && distance <= detectionRadius + EPSILON) {
        if (shade.state === 'drain') this.stopDraining(shade);
        shade.state = 'chase';
        const [dx, dz] = direction(x - shade.pos[0], z - shade.pos[2]);
        this.moveShade(shade, dx, dz, speed * DT);
      } else if (shade.state !== 'drain') {
        shade.state = 'wander';
        this.wander(shade, speed * DT / 2);
      }
    }
  }

  wander(shade, step) {
    const weak = this.closestLantern(shade.pos, lamp => this.isWeak(lamp));
    const target = weak ?? this.closestLantern(shade.pos, lamp => !lamp.lit);
    if (target) {
      const distance = horizontalDistance(shade.pos, target.pos);
      const [dx, dz] = direction(target.pos[0] - shade.pos[0], target.pos[2] - shade.pos[2]);
      if (!weak || distance > DRAIN_RADIUS + EPSILON) this.moveShade(shade, dx, dz, Math.min(distance, step));
      if (weak && horizontalDistance(shade.pos, weak.pos) <= DRAIN_RADIUS + EPSILON) {
        shade.state = 'drain';
        shade.targetLanternId = weak.id;
        shade.drainSteps = 0;
      }
    } else if (!this.moveShade(shade, Math.cos(shade.heading), Math.sin(shade.heading), step)) {
      shade.heading += Math.PI * (0.5 + this.random());
    }
  }

  flee(drifter, stolen, duration = 240) {
    drifter.state = 'flee';
    drifter.stolen = stolen;
    drifter.stateEnd = this.simTick + duration;
  }

  updateDrifters() {
    this.drifters = this.drifters.filter(drifter => drifter.state !== 'removed' &&
      (drifter.state !== 'flee' || drifter.stateEnd > this.simTick));
    const [x, , z] = this.player.pos;
    for (const drifter of this.drifters) {
      const distance = horizontalDistance(drifter.pos, this.player.pos);
      if (drifter.state !== 'flee') {
        const eligible = this.player.respawnAt === null && this.player.carried >= 5 && distance <= 15 + EPSILON;
        drifter.state = eligible ? 'chase' : 'idle';
      }
      const [dx, dz] = drifter.state === 'idle' ? [Math.cos(drifter.heading), Math.sin(drifter.heading)]
        : drifter.state === 'chase' ? direction(x - drifter.pos[0], z - drifter.pos[2])
        : direction(drifter.pos[0] - x, drifter.pos[2] - z, [1, 0]);
      const delta = (drifter.state === 'idle' ? 2 : DRIFT_SPEED) * DT;
      drifter.pos[0] += dx * delta;
      drifter.pos[2] += dz * delta;
      if (drifter.state === 'idle' && !Number.isFinite(groundHeight(this.world, drifter.pos[0], drifter.pos[2]))) {
        drifter.heading += 0.1;
      }
    }
  }

  checkSteals() {
    if (this.player.respawnAt !== null) return;
    for (const drifter of this.drifters.filter(item => item.state === 'chase').sort(byId)) {
      if (horizontalDistance(drifter.pos, this.player.pos) > 1.2 + EPSILON) continue;
      const amount = Math.min(3, this.player.carried);
      this.player.carried -= amount;
      this.flee(drifter, amount);
      this.emit('drifter_steal', { drifter_id: drifter.id, amount, carried: this.player.carried });
    }
  }

  dropMotes(count, center, atSpot = false) {
    if (!count) return;
    const offset = atSpot ? 0 : this.random() * Math.PI * 2;
    for (let index = 0; index < count; index++) {
      const heading = offset + index * Math.PI * 2 / count;
      const distance = atSpot ? 0 : 1.5 + this.random();
      const x = center[0] + Math.cos(heading) * distance;
      const z = center[2] + Math.sin(heading) * distance;
      const ground = groundHeight(this.world, x, z, center[1] + EPSILON);
      this.addMote([x, Number.isFinite(ground) ? ground : center[1], z], 'dropped', this.simTick + DROP_TTL);
    }
  }

  checkHits() {
    const player = this.player;
    if (player.respawnAt !== null || this.simTick < player.invuln) return;
    const hit = this.shades.filter(shade => !shade.exit && ['wander', 'chase'].includes(shade.state) &&
      !this.insideSafeZone(shade.pos) &&
      horizontalDistance(shade.pos, player.pos) <= this.tuning.shade_hit_radius + EPSILON &&
      Math.abs(shade.pos[1] - player.pos[1]) <= 1.5 + EPSILON).sort(byId)[0];
    if (!hit) return;
    const dropped = Math.floor(player.carried * this.tuning.hit_drop_ratio);
    player.flames--;
    player.carried -= dropped;
    player.invuln = this.simTick + ticks(this.tuning.invuln_s);
    this.dropMotes(dropped, player.pos);
    hit.state = 'recoil';
    hit.stateEnd = this.simTick + 61;
    hit.push = direction(hit.pos[0] - player.pos[0], hit.pos[2] - player.pos[2], [1, 0]);
    this.emit('player_hit', { by: 'shade', flames: player.flames, dropped });
  }

  checkEnd() {
    let reason;
    if (this.player.flames <= 0) reason = 'no_flames';
    else if (this.timeLeft <= 0) reason = this.litCount >= this.dawnTarget ? 'dawn_survived' : 'dawn';
    if (!reason) return;
    this.state = reason === 'dawn_survived' ? 'won' : 'lost';
    if (this.state === 'won') {
      for (const lantern of this.lanterns) {
        if (lantern.lit) this.score += this.tuning.score.per_dawn_lantern + Math.floor(lantern.fuelUnits / HZ);
      }
      this.score += this.player.flames * this.tuning.score.per_flame_left;
    }
    this.emit('game_over', { result: this.state, reason });
  }

  snapshot() {
    const player = this.player;
    const seconds = end => left(end, this.simTick) / HZ;
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.simTick, state: this.state,
      night: this.night, wind: { ...this.wind }, time_left_s: this.timeLeft, score: this.score,
      player: {
        pos: player.pos.map(round), vel: player.vel.map(round),
        flames: player.flames, carried: player.carried, grounded: player.grounded,
        capacity: this.capacity,
        invuln: player.invuln > this.simTick, dash_cd_s: seconds(player.dashCooldown),
        pulse_cd_s: seconds(player.pulseCooldown), charm_s: seconds(player.charmEnd),
      },
      lanterns: this.lanterns.map(({ id, pos, deposited, lit, fuelUnits, everLit, relitCount }) => ({
        id, pos: pos.map(round), deposited, lit, fuel: displayFuel(fuelUnits), ever_lit: everLit, relit_count: relitCount,
      })),
      shades: this.shades.map(({ id, pos, state }) => ({ id, pos: pos.map(round), state })),
      motes_active: this.motes.length,
      motes: this.motes.map(({ id, pos, kind, ttl }) => ({ id, pos: pos.map(round), kind, ttl_s: ttl === null ? null : seconds(ttl) })),
      drifters: this.drifters.map(({ id, pos, state, stolen }) => ({ id, pos: pos.map(round), state, stolen })),
      charms: this.charms.map(({ id, available, respawnAt }) => ({ id, available, respawn_s: seconds(respawnAt) })),
    };
  }
}
