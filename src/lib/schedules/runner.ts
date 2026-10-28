import { sendMany } from '../bridges';
import { roomCommands } from '../scenes';
import type { SceneStep } from '../model';
import type { Schedule, State } from '../model';
import { store } from '../store';
import { dueNow } from './next';
import { inQuietHours } from '../vacuum/status';

/** The steps a schedule sends when it runs. Pure. */
export function stepsFor(state: State, s: Schedule): SceneStep[] {
  if (s.target.kind === 'scene') return state.scenes.find((x) => x.id === s.target.id)?.steps ?? [];
  if (!s.command) return [];
  if (s.target.kind === 'thing') return [{ thingId: s.target.id, command: s.command }];
  const things = state.things.filter((t) => !t.hidden && t.rooms.includes(s.target.id));
  if (s.command.type === 'power') return roomCommands(things, s.command.on);
  return things.map((t) => ({ thingId: t.id, command: s.command as NonNullable<Schedule['command']> }));
}

let lastChecked = new Date();
let timer: ReturnType<typeof setInterval> | undefined;

/** Runs due schedules while the app is open on the hub device. Checks every 30 seconds. */
export function startRunner() {
  if (timer) return;
  lastChecked = new Date();
  timer = setInterval(() => void tick(new Date()), 30_000);
}

export function stopRunner() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

export async function tick(now: Date) {
  const state = store().get();
  store().update((s) => ({ ...s, hubSeenAt: now.getTime() }));
  if (state.settings.hub !== 'this') return;
  const due = dueNow(state.schedules, lastChecked, now, state.settings.home);
  lastChecked = now;
  for (const s of due) {
    const steps = stepsFor(state, s);
    const hhmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const quiet = inQuietHours(hhmm, state.vacuum.quietFrom, state.vacuum.quietTo);
    const allowed = steps.filter((st) => !(quiet && st.command.type === 'vacuum' && st.command.action === 'start'));
    await sendMany(allowed);
    store().update((st) => ({
      ...st,
      schedules: st.schedules.map((x) => (x.id === s.id ? { ...x, lastRun: now.getTime(), enabled: x.repeat === 'once' ? false : x.enabled } : x)),
    }));
  }
}
