/** Everything Home hub knows, in one shape. Pure types and defaults; no I/O. */

export type Brand = 'tuya' | 'govee' | 'vesync' | 'wiz';
export const BRAND_NAMES: Record<Brand, string> = { tuya: 'Smart Life', govee: 'Govee', vesync: 'VeSync', wiz: 'WiZ' };

export type Kind = 'plug' | 'light' | 'purifier' | 'vacuum';

/** A device from any brand. `id` is ours; `externalId` is the brand's. */
export interface Thing {
  id: string;
  brand: Brand;
  externalId: string;
  name: string;
  kind: Kind;
  rooms: string[];
  hidden: boolean;
  /** Brand details needed to talk to it (a Govee sku, a VeSync config module, a WiZ address). */
  meta: Record<string, string>;
  caps: Cap[];
}

export type Cap = 'power' | 'brightness' | 'colour' | 'temperature' | 'scene' | 'speed' | 'sleep' | 'display' | 'lock' | 'vacuum';

/** What a thing is doing right now. Facts only. */
export interface ThingState {
  online: boolean;
  on?: boolean;
  brightness?: number; // 1 to 100
  colour?: { r: number; g: number; b: number };
  temperature?: number; // kelvin
  speed?: number; // purifiers 1 to 3
  mode?: string; // purifier 'manual' | 'sleep'; vacuum mode
  display?: boolean;
  lock?: boolean;
  filterLife?: number; // percent
  battery?: number; // percent
  status?: string; // vacuum: standby, cleaning, returning, charging, charged, paused, sleep, error
  suction?: string;
  water?: string;
  cleanArea?: number; // square metres
  cleanTime?: number; // minutes
  error?: string;
  seenAt: number; // ms
}

export interface Room {
  id: string;
  name: string;
  order: number;
}

/** One command, the same for every brand. The bridge turns it into the brand's own call. */
export type Command =
  | { type: 'power'; on: boolean }
  | { type: 'brightness'; value: number }
  | { type: 'colour'; r: number; g: number; b: number }
  | { type: 'temperature'; kelvin: number }
  | { type: 'scene'; id: string }
  | { type: 'speed'; value: number }
  | { type: 'mode'; value: string }
  | { type: 'display'; on: boolean }
  | { type: 'lock'; on: boolean }
  | { type: 'vacuum'; action: VacuumAction; value?: string };

export type VacuumAction = 'start' | 'pause' | 'dock' | 'locate' | 'suction' | 'water' | 'mode';

export interface SceneStep {
  thingId: string;
  command: Command;
}

export interface Scene {
  id: string;
  name: string;
  steps: SceneStep[];
}

export type Repeat = 'daily' | 'weekdays' | 'weekends' | 'once' | 'days';
export type When = { kind: 'time'; hhmm: string } | { kind: 'sunset'; offsetMin: number } | { kind: 'sunrise'; offsetMin: number };

/** A schedule is one sentence: [target] [does] at [when] [repeat]. */
export interface Schedule {
  id: string;
  target: { kind: 'thing'; id: string } | { kind: 'room'; id: string } | { kind: 'scene'; id: string };
  command: Command | null; // null when the target is a scene
  when: When;
  repeat: Repeat;
  days: number[]; // 0 Sunday to 6 Saturday, used when repeat is 'days'
  enabled: boolean;
  lastRun?: number; // ms
  /** Set when the brand holds the timer itself (Tuya), so it runs with the phone off. */
  pushedTo?: string;
}

export interface CleanRecord {
  startedAt: number;
  minutes: number;
  area: number;
  finished: boolean;
}

export type Part = 'bin' | 'filter' | 'sideBrush' | 'mainBrush' | 'mop';
export const PARTS: { id: Part; name: string; hours: number }[] = [
  { id: 'bin', name: 'Dust bin', hours: 10 },
  { id: 'filter', name: 'Filter', hours: 150 },
  { id: 'sideBrush', name: 'Side brush', hours: 200 },
  { id: 'mainBrush', name: 'Main brush', hours: 300 },
  { id: 'mop', name: 'Mop pad', hours: 50 },
];

export interface VacuumSettings {
  thingId: string | null;
  usualSuction: string;
  quietFrom: string; // '22:00'
  quietTo: string; // '08:00'
  cleanWhenOut: boolean;
  minBattery: number; // percent
  history: CleanRecord[];
  /** Minutes of cleaning since each part was last done. */
  partMinutes: Record<Part, number>;
}

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  bigText: boolean;
  hub: 'this' | 'other'; // this device runs the app-side schedules
  home: { lat: number; lon: number } | null;
  tuyaRegion: 'eu' | 'us' | 'cn' | 'in';
}

export interface BrandStatus {
  connected: boolean;
  lastOk?: number;
  lastError?: string;
  /** For Tuya and Govee: when the trial or key needs renewing, if known. */
  renewBy?: number;
}

export interface State {
  version: 1;
  rooms: Room[];
  things: Thing[];
  states: Record<string, ThingState>;
  scenes: Scene[];
  schedules: Schedule[];
  vacuum: VacuumSettings;
  settings: Settings;
  brands: Record<Brand, BrandStatus>;
  hubSeenAt: number;
}

export function defaultVacuum(): VacuumSettings {
  return {
    thingId: null,
    usualSuction: 'normal',
    quietFrom: '22:00',
    quietTo: '08:00',
    cleanWhenOut: false,
    minBattery: 40,
    history: [],
    partMinutes: { bin: 0, filter: 0, sideBrush: 0, mainBrush: 0, mop: 0 },
  };
}

export function defaultState(): State {
  return {
    version: 1,
    rooms: [
      { id: 'living', name: 'Living room', order: 0 },
      { id: 'kitchen', name: 'Kitchen', order: 1 },
      { id: 'bedroom', name: 'Bedroom', order: 2 },
      { id: 'attic', name: 'Attic', order: 3 },
    ],
    things: [],
    states: {},
    scenes: [],
    schedules: [],
    vacuum: defaultVacuum(),
    settings: { theme: 'auto', bigText: false, hub: 'this', home: null, tuyaRegion: 'eu' },
    brands: { tuya: { connected: false }, govee: { connected: false }, vesync: { connected: false }, wiz: { connected: false } },
    hubSeenAt: 0,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Reads a saved state, filling in anything missing, so an older save still opens. */
export function readState(raw: unknown): State {
  const d = defaultState();
  if (!isRecord(raw)) return d;
  const pick = <T>(key: keyof State, fallback: T): T => (key in raw ? (raw[key] as T) : fallback);
  return {
    version: 1,
    rooms: pick('rooms', d.rooms),
    things: pick('things', d.things),
    states: pick('states', d.states),
    scenes: pick('scenes', d.scenes),
    schedules: pick('schedules', d.schedules),
    vacuum: { ...d.vacuum, ...pick('vacuum', {}) },
    settings: { ...d.settings, ...pick('settings', {}) },
    brands: { ...d.brands, ...pick('brands', {}) },
    hubSeenAt: pick('hubSeenAt', 0),
  };
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function thingsInRoom(state: State, roomId: string): Thing[] {
  return state.things.filter((t) => !t.hidden && t.rooms.includes(roomId));
}

/** Facts for the top of Home: how many things are on. */
export function countOn(state: State): { on: number; offline: number } {
  let on = 0;
  let offline = 0;
  for (const t of state.things) {
    if (t.hidden) continue;
    const s = state.states[t.id];
    if (!s || !s.online) offline += 1;
    else if (s.on) on += 1;
  }
  return { on, offline };
}
