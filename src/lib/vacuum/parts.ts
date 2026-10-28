import { PARTS, type CleanRecord, type Part, type VacuumSettings } from '../model';

/** Cleans left before each part needs doing, from minutes used and the maker's hours. Pure. */
export function partsDue(v: VacuumSettings, usualCleanMinutes = 45): { id: Part; name: string; cleansLeft: number; percentUsed: number }[] {
  return PARTS.map((p) => {
    const used = v.partMinutes[p.id] ?? 0;
    const limit = p.hours * 60;
    const left = Math.max(0, limit - used);
    return { id: p.id, name: p.name, cleansLeft: Math.floor(left / usualCleanMinutes), percentUsed: Math.min(100, Math.round((used / limit) * 100)) };
  });
}

export function addClean(v: VacuumSettings, record: CleanRecord): VacuumSettings {
  const partMinutes = { ...v.partMinutes };
  for (const p of PARTS) partMinutes[p.id] = (partMinutes[p.id] ?? 0) + record.minutes;
  return { ...v, history: [record, ...v.history].slice(0, 200), partMinutes };
}

export function partDone(v: VacuumSettings, part: Part): VacuumSettings {
  return { ...v, partMinutes: { ...v.partMinutes, [part]: 0 } };
}

/** The week view: cleans on each of the last seven days, oldest first. Pure. */
export function lastWeek(history: CleanRecord[], now: number): { day: string; cleans: number; minutes: number }[] {
  const out: { day: string; cleans: number; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 86_400_000;
    const todays = history.filter((h) => h.startedAt >= start && h.startedAt < end);
    out.push({ day: d.toLocaleDateString('en-GB', { weekday: 'short' }), cleans: todays.length, minutes: todays.reduce((a, h) => a + h.minutes, 0) });
  }
  return out;
}
