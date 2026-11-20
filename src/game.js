import { DT, HZ, direction, horizontalDistance, inputDirection, seededRandom, worlds } from './world.js';

export const buttons = ['jump', 'interact', 'pulse', 'dash'];
export const blankInput = { move: [0, 0], cam_yaw_deg: 0, ...Object.fromEntries(buttons.map(button => [button, false])) };
const ticks = seconds => Math.round((seconds ?? 0) * HZ);
const round = value => Math.round(value * 1000) / 1000 || 0;
const byId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });

export class Game {
  constructor(contract, { seed = 0, night = 1, scenario = {} } = {}) {
    this.tuning = contract.tuning;
    this.night = night;
    this.world = worlds[night];
    this.random = seededRandom(seed);
    this.events = [];
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.timeLeft = scenario.time_left_s ?? this.tuning.night1_duration_s;
    this.startTime = this.timeLeft;
    this.score = 0;
    this.previousInput = blankInput;
    const initial = scenario.player ?? {};
    this.player = {
      pos: [...(initial.pos ?? [0, 0, 0])],
      vel: [0, 0, 0],
      grounded: (initial.pos?.[1] ?? 0) === 0,
      facing: [0, 1],
      carried: initial.carried ?? 0,
      flames: initial.flames ?? this.tuning.flames,
      invuln: 0,
      pulseCooldown: 0,
    };

    this.ids = { M: 0, S: 0 };
    const changes = new Map((scenario.lanterns ?? []).map(item => [item.id, item]));
    this.lanterns = this.world.lanterns.map((pos, index) => {
      const id = 'L' + (index + 1);
      const item = changes.get(id) ?? {};
      const deposited = item.deposited ?? (item.lit ? this.tuning.lantern_cost : 0);
      return {
        id, pos: [...(item.pos ?? pos)], deposited,
        lit: item.lit ?? (deposited >= this.tuning.lantern_cost),
      };
    });
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.motes = [];
    this.shades = [];
    if (scenario.motes) {
      for (const pos of scenario.motes) this.addMote(pos);
    } else if (this.randomMotes) {
      for (let index = 0; index < 20; index++) this.spawnMote();
    }
    for (const item of scenario.shades ?? []) this.addShade(item);
  }

  emit(name, data = {}) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  makeId(prefix, supplied) {
    if (!supplied) return prefix + ++this.ids[prefix];
    const suffix = supplied.startsWith(prefix) && /^\d+$/.test(supplied.slice(1)) ? Number(supplied.slice(1)) : 0;
    if (Number.isSafeInteger(suffix)) this.ids[prefix] = Math.max(this.ids[prefix], suffix);
    return supplied;
  }

  choose(items) {
    return items[Math.floor(this.random() * items.length)];
  }

  addMote(pos, kind = 'random', ttl = null, spot = null) {
    this.motes.push({ id: this.makeId('M'), pos: [...pos], kind, ttl, spot });
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

  addShade({ id, pos }) {
    const shade = {
      id: this.makeId('S', id), pos: [...pos], state: 'wander',
      stunEnd: 0, pushLeft: 0, push: [0, 0], ejected: false,
      heading: this.random() * Math.PI * 2,
    };
    this.shades.push(shade);
    return shade;
  }

  spawnShades() {
    const lit = this.lanterns.filter(lantern => lantern.lit);
    const candidates = this.world.shadeSpots.filter(pos =>
      horizontalDistance(pos, this.player.pos) >= 15 &&
      !lit.some(lantern => horizontalDistance(pos, lantern.pos) < this.tuning.safe_radius) &&
      !this.shades.some(shade => horizontalDistance(shade.pos, pos) < 2));
    const count = this.simTick === 300 ? 2 : 1;
    for (let index = 0; index < count && candidates.length && this.shades.length < this.world.shadeLimit; index++) {
      const [spot] = candidates.splice(Math.floor(this.random() * candidates.length), 1);
      const shade = this.addShade({ pos: [spot[0], spot[1] + 0.8, spot[2]] });
      this.emit('shade_spawned', { id: shade.id });
    }
  }

  step(input = blankInput) {
    this.events = [];
    if (this.state !== 'playing') return this.events;
    this.tick++;
    this.simTick++;
    this.timeLeft = Math.max(0, this.startTime - this.simTick / HZ);
    const pressed = button => input[button] && !this.previousInput[button];

    this.movePlayer(input, pressed('jump'));
    this.pickMotes();
    if (pressed('interact')) this.deposit();
    this.updateSafeZones();
    if (pressed('pulse')) this.pulse();
    this.updateShades();
    this.checkHits();
    this.motes = this.motes.filter(mote => mote.ttl === null || mote.ttl > this.simTick);
    if (this.randomMotes && this.simTick % 240 === 0) this.spawnMote();
    if (this.randomShades && this.simTick >= 300 && (this.simTick - 300) % this.world.shadeInterval === 0) this.spawnShades();
    this.checkEnd();
    this.previousInput = { ...input };
    return this.events;
  }

  movePlayer(input, jump) {
    const player = this.player;
    const [x, z] = inputDirection(input.move, input.cam_yaw_deg);
    if (x || z) player.facing = direction(x, z);
    player.vel[0] = x * this.tuning.player_speed;
    player.vel[2] = z * this.tuning.player_speed;
    const next = player.pos.map((value, axis) => value + player.vel[axis] * DT);
    const limit = this.world.disks[0].radius;
    if (Math.hypot(next[0], next[2]) > limit) {
      const [nx, nz] = direction(next[0], next[2]);
      next[0] = nx * limit;
      next[2] = nz * limit;
    }
    if (jump && player.grounded) {
      player.vel[1] = 7;
      player.grounded = false;
    }
    next[1] = player.grounded ? 0 : player.pos[1] + player.vel[1] * DT;
    if (next[1] <= 0 && player.vel[1] <= 0) {
      next[1] = 0;
      player.vel[1] = 0;
      player.grounded = true;
    } else if (!player.grounded) {
      player.vel[1] -= 20 * DT;
    }
    player.pos = next;
  }

  pickMotes() {
    this.motes = this.motes.filter(mote => {
      if (mote.available > this.simTick || this.player.carried >= this.tuning.carry_capacity ||
          horizontalDistance(this.player.pos, mote.pos) > this.tuning.pickup_radius ||
          Math.abs(this.player.pos[1] - mote.pos[1]) > 1.5) return true;
      this.player.carried++;
      this.score += this.tuning.score.per_mote;
      this.emit('mote_picked', { carried: this.player.carried });
      return false;
    });
  }

  nearbyLantern() {
    return this.lanterns
      .filter(lantern => !lantern.lit && horizontalDistance(this.player.pos, lantern.pos) <= this.tuning.interact_radius)
      .sort((a, b) => horizontalDistance(this.player.pos, a.pos) - horizontalDistance(this.player.pos, b.pos) || byId(a, b))[0];
  }

  deposit() {
    const lantern = this.nearbyLantern();
    if (!lantern) return;
    const amount = Math.min(this.player.carried, this.tuning.lantern_cost - lantern.deposited);
    if (amount <= 0) return;
    this.player.carried -= amount;
    lantern.deposited += amount;
    this.emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited < this.tuning.lantern_cost) return;
    lantern.lit = true;
    this.score += this.tuning.score.per_lantern;
    this.emit('lantern_lit', { lantern_id: lantern.id });
  }

  updateSafeZones() {
    for (const shade of this.shades) {
      const lantern = this.lanterns.find(item => item.lit && horizontalDistance(shade.pos, item.pos) < this.tuning.safe_radius);
      if (!lantern) continue;
      const [x, z] = direction(shade.pos[0] - lantern.pos[0], shade.pos[2] - lantern.pos[2], [1, 0]);
      shade.pos[0] = lantern.pos[0] + x * this.tuning.safe_radius;
      shade.pos[2] = lantern.pos[2] + z * this.tuning.safe_radius;
    }
  }

  pulse() {
    const player = this.player;
    if (player.carried < this.tuning.pulse_cost || this.simTick < player.pulseCooldown) return;
    player.carried -= this.tuning.pulse_cost;
    player.pulseCooldown = this.simTick + ticks(this.tuning.pulse_cooldown_s);
    const targets = this.shades.filter(shade => horizontalDistance(shade.pos, player.pos) <= this.tuning.pulse_radius).sort(byId);
    for (const shade of targets) {
      shade.state = 'stunned';
      shade.stunEnd = this.simTick + ticks(this.tuning.pulse_stun_s);
      shade.pushLeft = 15;
      shade.push = direction(shade.pos[0] - player.pos[0], shade.pos[2] - player.pos[2], [1, 0]);
    }
    this.score += targets.length * this.tuning.score.per_stun;
    this.emit('pulse', { stunned_ids: targets.map(shade => shade.id) });
  }

  moveShade(shade, x, z, delta) {
    const next = [shade.pos[0] + x * delta, shade.pos[1], shade.pos[2] + z * delta];
    if (Math.hypot(next[0], next[2]) > this.world.disks[0].radius) return false;
    if (this.lanterns.some(lantern => lantern.lit &&
        horizontalDistance(next, lantern.pos) < this.tuning.safe_radius &&
        horizontalDistance(next, lantern.pos) < horizontalDistance(shade.pos, lantern.pos))) return false;
    shade.pos = next;
    return true;
  }

  updateShades() {
    for (const shade of this.shades) {
      if (shade.stunEnd > this.simTick) {
        if (shade.pushLeft && !this.moveShade(shade, ...shade.push, this.tuning.pulse_push_m / 15)) shade.pushLeft = 1;
        shade.pushLeft = Math.max(0, shade.pushLeft - 1);
        continue;
      }
      const [x, , z] = this.player.pos;
      const distance = horizontalDistance(shade.pos, this.player.pos);
      if (distance <= 12 || (shade.state === 'chase' && distance <= 18)) {
        shade.state = 'chase';
        const [dx, dz] = direction(x - shade.pos[0], z - shade.pos[2]);
        this.moveShade(shade, dx, dz, this.tuning.shade_speed * DT);
      } else {
        shade.state = 'wander';
        if (!this.moveShade(shade, Math.cos(shade.heading), Math.sin(shade.heading), this.tuning.shade_speed * DT / 2)) {
          shade.heading += Math.PI * (0.5 + this.random());
        }
      }
    }
  }

  dropMotes(count, center) {
    const offset = this.random() * Math.PI * 2;
    for (let index = 0; index < count; index++) {
      const heading = offset + index * Math.PI * 2 / count;
      const distance = 1.5 + this.random();
      const pos = [center[0] + Math.cos(heading) * distance, 0, center[2] + Math.sin(heading) * distance];
      this.addMote(pos, 'dropped', this.simTick + 480);
      this.motes.at(-1).available = this.simTick + 1;
    }
  }

  checkHits() {
    const player = this.player;
    if (this.simTick < player.invuln || this.lanterns.some(lantern =>
      lantern.lit && horizontalDistance(lantern.pos, player.pos) < this.tuning.safe_radius)) return;
    const hit = this.shades.find(shade => shade.state !== 'stunned' &&
      horizontalDistance(shade.pos, player.pos) <= this.tuning.shade_hit_radius &&
      Math.abs(shade.pos[1] - player.pos[1]) <= 1.5);
    if (!hit) return;
    const dropped = Math.floor(player.carried * this.tuning.hit_drop_ratio);
    player.flames--;
    player.carried -= dropped;
    player.invuln = this.simTick + ticks(this.tuning.invuln_s);
    this.dropMotes(dropped, player.pos);
    this.emit('player_hit', { by: 'shade', flames: player.flames, dropped });
  }

  checkEnd() {
    let reason;
    if (this.player.flames <= 0) reason = 'no_flames';
    else if (this.lanterns.every(lantern => lantern.lit)) reason = 'all_lit';
    else if (this.timeLeft <= 0) reason = 'dawn';
    if (!reason) return;
    this.state = reason === 'all_lit' ? 'won' : 'lost';
    if (this.state === 'won') {
      this.score += Math.floor(this.timeLeft) * this.tuning.score.per_second_left +
        this.player.flames * this.tuning.score.per_flame_left;
    }
    this.emit('game_over', { result: this.state, reason });
  }

  snapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: this.timeLeft,
      score: this.score,
      player: { pos: this.player.pos.map(round), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map(lantern => ({ ...lantern, pos: lantern.pos.map(round) })),
      shades: this.shades.map(({ id, pos, state }) => ({ id, pos: pos.map(round), state })),
      motes_active: this.motes.length,
      motes: this.motes.map(({ id, pos }) => ({ id, pos: pos.map(round) })),
    };
  }
}
