import { defaultState, type State } from './model';

export function showcaseRequested(search: string): boolean {
  return import.meta.env['VITE_SHOWCASE'] === 'true' && new URLSearchParams(search).has('showcase');
}

/** True while the made-up house is shown, so nothing tries to reach a real device. */
export function inShowcase(): boolean {
  return typeof window !== 'undefined' && showcaseRequested(window.location.search);
}

/** A made-up house for screenshots and development: no real device, nothing saved. */
export function showcaseState(): State {
  const d = defaultState();
  const now = Date.now();
  const things: State['things'] = [
    { id: 't1', brand: 'tuya', externalId: 'a1', name: 'Kitchen wax', kind: 'plug', rooms: ['kitchen'], hidden: false, meta: {}, caps: ['power'] },
    { id: 't2', brand: 'tuya', externalId: 'a2', name: 'Bedroom salt lamp', kind: 'plug', rooms: ['bedroom'], hidden: false, meta: {}, caps: ['power'] },
    { id: 't3', brand: 'tuya', externalId: 'a3', name: 'Buddha lamp', kind: 'plug', rooms: ['bedroom'], hidden: false, meta: {}, caps: ['power'] },
    { id: 't4', brand: 'tuya', externalId: 'a4', name: 'Lounge candle lamp', kind: 'plug', rooms: ['living'], hidden: false, meta: {}, caps: ['power'] },
    { id: 't5', brand: 'tuya', externalId: 'a5', name: 'Kitchen candle lamp', kind: 'plug', rooms: ['kitchen'], hidden: false, meta: {}, caps: ['power'] },
    { id: 'w1', brand: 'wiz', externalId: 'm1', name: 'Living room ceiling', kind: 'light', rooms: ['living'], hidden: false, meta: {}, caps: ['power', 'brightness', 'temperature', 'colour', 'scene'] },
    { id: 'w2', brand: 'wiz', externalId: 'm2', name: 'Attic lamp', kind: 'light', rooms: ['attic'], hidden: false, meta: {}, caps: ['power', 'brightness', 'temperature', 'colour', 'scene'] },
    { id: 'g1', brand: 'govee', externalId: 'g1', name: 'TV light strip', kind: 'light', rooms: ['living'], hidden: false, meta: {}, caps: ['power', 'brightness', 'colour', 'scene'] },
    { id: 'v1', brand: 'vesync', externalId: 'v1', name: 'Lounge purifier', kind: 'purifier', rooms: ['living'], hidden: false, meta: {}, caps: ['power', 'speed', 'sleep', 'display', 'lock'] },
    { id: 'v2', brand: 'vesync', externalId: 'v2', name: 'Bedroom purifier', kind: 'purifier', rooms: ['bedroom'], hidden: false, meta: {}, caps: ['power', 'speed', 'sleep', 'display', 'lock'] },
    { id: 'd1', brand: 'tuya', externalId: 'd1', name: 'Dustin Bieber', kind: 'vacuum', rooms: [], hidden: false, meta: {}, caps: ['vacuum', 'power'] },
  ];
  const states: State['states'] = {
    t1: { online: false, on: false, seenAt: now - 2 * 86_400_000 },
    t2: { online: true, on: true, seenAt: now },
    t3: { online: true, on: true, seenAt: now },
    t4: { online: true, on: false, seenAt: now },
    t5: { online: true, on: false, seenAt: now },
    w1: { online: true, on: true, brightness: 60, temperature: 2700, seenAt: now },
    w2: { online: true, on: false, brightness: 100, seenAt: now },
    g1: { online: true, on: true, brightness: 40, colour: { r: 255, g: 140, b: 60 }, seenAt: now },
    v1: { online: true, on: true, speed: 2, mode: 'manual', display: true, lock: false, filterLife: 62, seenAt: now },
    v2: { online: true, on: true, speed: 1, mode: 'sleep', display: false, lock: false, filterLife: 48, seenAt: now },
    d1: { online: true, on: true, status: 'charging', battery: 82, suction: 'normal', water: 'middle', cleanArea: 38, cleanTime: 41, seenAt: now },
  };
  return {
    ...d,
    things,
    states,
    scenes: [
      {
        id: 's1',
        name: 'Bedtime',
        steps: [
          { thingId: 't2', command: { type: 'power', on: true } },
          { thingId: 't3', command: { type: 'power', on: false } },
          { thingId: 'w1', command: { type: 'power', on: false } },
          { thingId: 'g1', command: { type: 'power', on: false } },
          { thingId: 'v2', command: { type: 'mode', value: 'sleep' } },
          { thingId: 'v1', command: { type: 'power', on: false } },
        ],
      },
      {
        id: 's2',
        name: 'Evening',
        steps: [
          { thingId: 't4', command: { type: 'power', on: true } },
          { thingId: 't5', command: { type: 'power', on: true } },
          { thingId: 'w1', command: { type: 'brightness', value: 40 } },
          { thingId: 'g1', command: { type: 'power', on: true } },
        ],
      },
      { id: 's3', name: 'Away', steps: [{ thingId: 'w1', command: { type: 'power', on: false } }, { thingId: 'd1', command: { type: 'vacuum', action: 'start' } }] },
    ],
    schedules: [
      { id: 'h1', target: { kind: 'thing', id: 't2' }, command: { type: 'power', on: true }, when: { kind: 'sunset', offsetMin: -30 }, repeat: 'daily', days: [], enabled: true, lastRun: now - 86_400_000 },
      { id: 'h2', target: { kind: 'scene', id: 's1' }, command: null, when: { kind: 'time', hhmm: '23:00' }, repeat: 'daily', days: [], enabled: true, lastRun: now - 80_000_000 },
      { id: 'h3', target: { kind: 'thing', id: 'd1' }, command: { type: 'vacuum', action: 'start' }, when: { kind: 'time', hhmm: '10:00' }, repeat: 'weekdays', days: [], enabled: true, pushedTo: 'Smart Life' },
    ],
    vacuum: {
      ...d.vacuum,
      thingId: 'd1',
      history: [
        { startedAt: now - 86_400_000 * 1 - 3_600_000, minutes: 41, area: 38, finished: true },
        { startedAt: now - 86_400_000 * 2 - 3_600_000, minutes: 44, area: 40, finished: true },
        { startedAt: now - 86_400_000 * 4 - 3_600_000, minutes: 12, area: 9, finished: false },
        { startedAt: now - 86_400_000 * 5 - 3_600_000, minutes: 43, area: 39, finished: true },
      ],
      partMinutes: { bin: 420, filter: 7_800, sideBrush: 3_100, mainBrush: 9_900, mop: 2_700 },
    },
    settings: { ...d.settings, home: { lat: 49.45, lon: -2.58 } },
    brands: { tuya: { connected: true, lastOk: now }, govee: { connected: true, lastOk: now }, vesync: { connected: true, lastOk: now }, wiz: { connected: true, lastOk: now } },
    hubSeenAt: now - 120_000,
  };
}
