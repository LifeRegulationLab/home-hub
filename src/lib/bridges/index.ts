import type { Brand, Command, State, Thing, ThingState } from '../model';
import type { Found } from './types';
import { newId } from '../model';
import { store } from '../store';
import { applyLocally } from '../scenes';
import { GoveeBridge } from './govee';
import { TuyaBridge } from './tuya';
import { VesyncBridge } from './vesync';
import { WizBridge } from './wiz';
import { BridgeError, type Bridge } from './types';

let bridges: Record<Brand, Bridge> | null = null;

export function allBridges(): Record<Brand, Bridge> {
  bridges ??= {
    tuya: new TuyaBridge(store().get().settings.tuyaRegion),
    govee: new GoveeBridge(),
    vesync: new VesyncBridge(),
    wiz: new WizBridge(),
  };
  return bridges;
}

/** After keys change, the next call makes fresh bridges. */
export function resetBridges() {
  bridges = null;
}

export function plainError(e: unknown): string {
  if (e instanceof BridgeError) return e.message;
  if (e instanceof Error) return e.message.includes('Failed to fetch') ? 'No answer from the internet' : e.message;
  return 'Something went wrong';
}

/** Merges found devices into the things list, keeping names and rooms you set. Pure. */
export function mergeFound(state: State, brand: Brand, found: Found[]): State {
  const things = [...state.things];
  const states = { ...state.states };
  for (const f of found) {
    const existing = things.find((t) => t.brand === brand && t.externalId === f.externalId);
    if (existing) {
      existing.caps = f.caps;
      existing.meta = { ...existing.meta, ...f.meta };
      states[existing.id] = f.state;
    } else {
      const id = newId(brand);
      things.push({ id, brand, externalId: f.externalId, name: f.name, kind: f.kind, rooms: [], hidden: false, meta: f.meta, caps: f.caps });
      states[id] = f.state;
    }
  }
  return { ...state, things, states };
}

/** Finds a brand's devices and records how it went in Settings. */
export async function discover(brand: Brand): Promise<{ count: number; error?: string }> {
  const bridge = allBridges()[brand];
  try {
    const found = await bridge.discover();
    store().update((s) => ({ ...mergeFound(s, brand, found), brands: { ...s.brands, [brand]: { connected: true, lastOk: Date.now() } } }));
    return { count: found.length };
  } catch (e) {
    const error = plainError(e);
    store().update((s) => ({ ...s, brands: { ...s.brands, [brand]: { ...s.brands[brand], connected: false, lastError: error } } }));
    return { count: 0, error };
  }
}

/** Reads every thing of the brands that are ready. Quietly skips what does not answer. */
export async function refreshAll(): Promise<void> {
  const state = store().get();
  const b = allBridges();
  await Promise.all(
    state.things.map(async (t) => {
      try {
        const fresh = await b[t.brand].read(t);
        store().update((s) => ({ ...s, states: { ...s.states, [t.id]: fresh } }));
      } catch {
        store().update((s) => {
          const old = s.states[t.id];
          const stale: ThingState = old ? { ...old, online: false } : { online: false, seenAt: Date.now() };
          return { ...s, states: { ...s.states, [t.id]: stale } };
        });
      }
    }),
  );
}

/** Sends one command, shows the result at once, and reads the true state a moment later. */
export async function send(thing: Thing, command: Command): Promise<void> {
  store().update((s) => ({ ...s, states: { ...s.states, [thing.id]: applyLocally(s.states[thing.id], command) } }));
  const bridge = allBridges()[thing.brand];
  await bridge.send(thing, command);
  setTimeout(() => {
    bridge
      .read(thing)
      .then((fresh) => store().update((s) => ({ ...s, states: { ...s.states, [thing.id]: fresh } })))
      .catch(() => undefined);
  }, 1500);
}

export async function sendMany(steps: { thingId: string; command: Command }[]): Promise<string[]> {
  const state = store().get();
  const errors: string[] = [];
  await Promise.all(
    steps.map(async (step) => {
      const thing = state.things.find((t) => t.id === step.thingId);
      if (!thing) return;
      try {
        await send(thing, step.command);
      } catch (e) {
        errors.push(`${thing.name}: ${plainError(e)}`);
      }
    }),
  );
  return errors;
}
