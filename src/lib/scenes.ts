import type { Command, Scene, SceneStep, State, Thing, ThingState } from './model';
import { newId } from './model';

/** A scene from how the house is now: one step per thing with its present power and level. Pure. */
export function sceneFromNow(state: State, name: string): Scene {
  const steps: SceneStep[] = [];
  for (const t of state.things) {
    if (t.hidden || t.kind === 'vacuum') continue;
    const s = state.states[t.id];
    if (!s) continue;
    if (typeof s.on === 'boolean') steps.push({ thingId: t.id, command: { type: 'power', on: s.on } });
    if (s.on && typeof s.brightness === 'number' && t.caps.includes('brightness')) steps.push({ thingId: t.id, command: { type: 'brightness', value: s.brightness } });
    if (s.on && typeof s.speed === 'number' && t.caps.includes('speed')) steps.push({ thingId: t.id, command: { type: 'speed', value: s.speed } });
  }
  return { id: newId('scene'), name, steps };
}

/** What a scene step says in words, for the Scenes page. Pure. */
export function stepWords(thing: Thing | undefined, c: Command): string {
  const name = thing?.name ?? 'a thing';
  switch (c.type) {
    case 'power':
      return `${name} ${c.on ? 'on' : 'off'}`;
    case 'brightness':
      return `${name} at ${c.value}%`;
    case 'speed':
      return `${name} speed ${c.value}`;
    case 'mode':
      return `${name} ${c.value}`;
    case 'temperature':
      return `${name} ${c.kelvin}K`;
    case 'colour':
      return `${name} coloured`;
    case 'scene':
      return `${name} mode ${c.id}`;
    case 'display':
      return `${name} display ${c.on ? 'on' : 'off'}`;
    case 'lock':
      return `${name} ${c.on ? 'locked' : 'unlocked'}`;
    case 'vacuum':
      return `${name} ${c.action}`;
  }
}

/** The commands a room switch sends: power to every thing in the room that can take it. Pure. */
export function roomCommands(things: Thing[], on: boolean): SceneStep[] {
  return things.filter((t) => t.caps.includes('power') && t.kind !== 'vacuum').map((t) => ({ thingId: t.id, command: { type: 'power', on } }));
}

/** The state a command would leave a thing in, so Home updates at once and corrects itself after the read. Pure. */
export function applyLocally(s: ThingState | undefined, c: Command): ThingState {
  const base: ThingState = s ?? { online: true, seenAt: Date.now() };
  switch (c.type) {
    case 'power':
      return { ...base, on: c.on };
    case 'brightness':
      return { ...base, on: true, brightness: c.value };
    case 'speed':
      return { ...base, on: true, speed: c.value, mode: 'manual' };
    case 'mode':
      return { ...base, on: true, mode: c.value };
    case 'temperature':
      return { ...base, on: true, temperature: c.kelvin };
    case 'colour':
      return { ...base, on: true, colour: { r: c.r, g: c.g, b: c.b } };
    case 'display':
      return { ...base, display: c.on };
    case 'lock':
      return { ...base, lock: c.on };
    case 'scene':
      return { ...base, on: true };
    case 'vacuum': {
      const status = c.action === 'start' ? 'cleaning' : c.action === 'dock' ? 'returning' : c.action === 'pause' ? 'paused' : base.status;
      return status === undefined ? base : { ...base, status };
    }
  }
}
