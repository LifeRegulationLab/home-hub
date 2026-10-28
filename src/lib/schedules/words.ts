import type { Command, Schedule, State, When } from '../model';

export function commandWords(c: Command | null): string {
  if (!c) return 'runs';
  switch (c.type) {
    case 'power':
      return c.on ? 'on' : 'off';
    case 'brightness':
      return `to ${c.value}%`;
    case 'colour':
      return 'to a colour';
    case 'temperature':
      return c.kelvin <= 3000 ? 'warm white' : c.kelvin >= 5000 ? 'cool white' : 'white';
    case 'scene':
      return 'to a mode';
    case 'speed':
      return `to speed ${c.value}`;
    case 'mode':
      return c.value === 'sleep' ? 'to sleep mode' : `to ${c.value}`;
    case 'display':
      return c.on ? 'display on' : 'display off';
    case 'lock':
      return c.on ? 'locked' : 'unlocked';
    case 'vacuum':
      return c.action === 'start' ? 'cleans' : c.action === 'dock' ? 'goes home' : c.action;
  }
}

export function whenWords(w: When): string {
  if (w.kind === 'time') return `at ${w.hhmm}`;
  const name = w.kind === 'sunset' ? 'sunset' : 'sunrise';
  if (w.offsetMin === 0) return `at ${name}`;
  const n = Math.abs(w.offsetMin);
  return `${n} minute${n === 1 ? '' : 's'} ${w.offsetMin < 0 ? 'before' : 'after'} ${name}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function repeatWords(s: Pick<Schedule, 'repeat' | 'days'>): string {
  switch (s.repeat) {
    case 'daily':
      return 'every day';
    case 'weekdays':
      return 'on weekdays';
    case 'weekends':
      return 'at weekends';
    case 'once':
      return 'once';
    case 'days':
      return s.days.length ? `on ${s.days.map((d) => DAY_NAMES[d] ?? '').join(', ')}` : 'never';
  }
}

export function targetName(state: State, s: Schedule): string {
  if (s.target.kind === 'thing') return state.things.find((t) => t.id === s.target.id)?.name ?? 'a thing';
  if (s.target.kind === 'room') return state.rooms.find((r) => r.id === s.target.id)?.name ?? 'a room';
  return state.scenes.find((x) => x.id === s.target.id)?.name ?? 'a scene';
}

/** The whole sentence: "Bedroom lamps on at 17:30 every day". Pure. */
export function scheduleSentence(state: State, s: Schedule): string {
  return `${targetName(state, s)} ${commandWords(s.command)} ${whenWords(s.when)} ${repeatWords(s)}`;
}

/** "Tonight 17:30", "Tomorrow 17:30", "Friday 17:30", in words a person checks at a glance. Pure. */
export function runWords(at: Date, now: Date): string {
  const hhmm = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return `${at.getHours() >= 17 ? 'Tonight' : 'Today'} ${hhmm}`;
  if (days === 1) return `Tomorrow ${hhmm}`;
  if (days < 7) return `${DAY_NAMES[at.getDay()] ?? ''} ${hhmm}`;
  return `${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${hhmm}`;
}
