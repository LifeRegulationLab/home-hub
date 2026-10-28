import type { Brand, Command, Thing, ThingState } from '../model';

/** A found device, before it becomes a Thing: what the brand calls it and what it can do. */
export interface Found {
  externalId: string;
  name: string;
  kind: Thing['kind'];
  caps: Thing['caps'];
  meta: Record<string, string>;
  state: ThingState;
}

/** Every brand looks the same to the app: find things, read them, and send one command. */
export interface Bridge {
  brand: Brand;
  /** True when the keys or login it needs are present. */
  ready(): Promise<boolean>;
  /** Finds the devices on the account (or, for WiZ, on the Wi-Fi) with their current state. */
  discover(): Promise<Found[]>;
  /** Reads one thing's current state. */
  read(thing: Thing): Promise<ThingState>;
  /** Sends one command. Throws with a plain message when it fails. */
  send(thing: Thing, command: Command): Promise<void>;
}

export class BridgeError extends Error {}

export function nowState(partial: Partial<ThingState> = {}): ThingState {
  return { online: true, seenAt: Date.now(), ...partial };
}
