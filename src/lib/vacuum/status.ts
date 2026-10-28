import type { ThingState } from '../model';

/**
 * Dustin's state from Tuya's data points, in plain words. The codes come from Tuya's robot vacuum
 * category and tuya-local's Ultenic T10 profile; unknown codes are left alone, never guessed.
 */
const STATUS_WORDS: Record<string, ThingState['status']> = {
  standby: 'standby',
  smart_clean: 'cleaning',
  wall_clean: 'cleaning',
  spot_clean: 'cleaning',
  mop_clean: 'cleaning',
  cleaning: 'cleaning',
  zone_clean: 'cleaning',
  part_clean: 'cleaning',
  select_room: 'cleaning',
  goto_charge: 'returning',
  docking: 'returning',
  charging: 'charging',
  charge_done: 'charged',
  fully_charged: 'charged',
  paused: 'paused',
  pause: 'paused',
  sleep: 'sleep',
  fault: 'error',
  error: 'error',
};

export function vacuumStateFromTuya(dps: Map<string, unknown>): Partial<ThingState> {
  const s: Partial<ThingState> = {};
  const power = dps.get('power');
  if (typeof power === 'boolean') s.on = power;
  const status = dps.get('status');
  if (typeof status === 'string') s.status = STATUS_WORDS[status] ?? status;
  const battery = dps.get('residual_electricity') ?? dps.get('electricity_left') ?? dps.get('battery_percentage');
  if (typeof battery === 'number') s.battery = battery;
  const suction = dps.get('suction');
  if (typeof suction === 'string') s.suction = suction;
  const water = dps.get('cistern');
  if (typeof water === 'string') s.water = water;
  const mode = dps.get('mode');
  if (typeof mode === 'string') s.mode = mode;
  const area = dps.get('clean_area');
  if (typeof area === 'number') s.cleanArea = area;
  const time = dps.get('clean_time');
  if (typeof time === 'number') s.cleanTime = time;
  const fault = dps.get('fault');
  if (typeof fault === 'number' && fault !== 0) s.error = faultWords(fault);
  if (typeof fault === 'string' && fault && fault !== '0') s.error = fault;
  return s;
}

/** Tuya's fault bits for robot vacuums, as sentences. Bits not in the list are shown by number. */
const FAULTS: [number, string][] = [
  [1, 'Edge sensor needs a wipe'],
  [2, 'Middle sweep brush is stuck'],
  [4, 'Side brush is stuck'],
  [8, 'Main brush is stuck'],
  [16, 'Dust bin is out'],
  [32, 'A wheel is lifted; put me on the floor'],
  [64, 'Battery is too low to start'],
  [128, 'I am stuck; give me a hand'],
  [256, 'Cliff sensor needs a wipe'],
  [512, 'Fan has a problem'],
  [1024, 'Water tank is out'],
  [2048, 'Bumper is stuck'],
];

export function faultWords(code: number): string {
  const lines = FAULTS.filter(([bit]) => (code & bit) !== 0).map(([, words]) => words);
  return lines.length ? lines.join('; ') : `Fault ${code}`;
}

/** The one status line for Home and the lock screen. Pure. */
export function statusLine(name: string, s: ThingState | undefined): string {
  if (!s || !s.online) return `${name}: not answering`;
  const pct = typeof s.battery === 'number' ? `, ${s.battery}%` : '';
  if (s.error) return `${name}: ${s.error}`;
  switch (s.status) {
    case 'cleaning':
      return `${name}: cleaning${typeof s.cleanTime === 'number' ? `, ${s.cleanTime} minutes in` : ''}${pct}`;
    case 'returning':
      return `${name}: going home${pct}`;
    case 'charging':
      return `${name}: charging${pct}`;
    case 'charged':
      return `${name}: charged and ready${pct}`;
    case 'paused':
      return `${name}: paused${pct}`;
    case 'sleep':
      return `${name}: asleep on the dock${pct}`;
    case 'error':
      return `${name}: needs a hand${pct}`;
    default:
      return `${name}: ready${pct}`;
  }
}

/** True between quietFrom and quietTo (which may cross midnight). Pure. */
export function inQuietHours(hhmmNow: string, quietFrom: string, quietTo: string): boolean {
  const m = (t: string) => {
    const [h = '0', mi = '0'] = t.split(':');
    return Number(h) * 60 + Number(mi);
  };
  const now = m(hhmmNow);
  const from = m(quietFrom);
  const to = m(quietTo);
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

export const SUCTION_WORDS: Record<string, string> = { quiet: 'Quiet', gentle: 'Gentle', normal: 'Normal', strong: 'Strong', max: 'Max' };
export const MODE_WORDS: Record<string, string> = {
  smart: 'Whole house',
  spiral: 'Spot, where I am',
  wall_follow: 'Edges',
  mop: 'Mop',
  zone: 'An area',
  pose: 'Go to a point',
  select_room: 'Chosen rooms',
};
