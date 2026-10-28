import { useState } from 'react';
import { Link } from 'react-router';
import { plainError, send } from '../lib/bridges';
import { BRAND_NAMES, type Thing, type ThingState } from '../lib/model';
import { Switch } from './ui';

export const KIND_EMOJI: Record<Thing['kind'], string> = { plug: '🔌', light: '💡', purifier: '🌬️', vacuum: '🤖' };

export function detailLine(t: Thing, s: ThingState | undefined): string {
  if (!s || !s.online) return 'Not answering';
  const bits: string[] = [];
  if (t.kind === 'purifier') {
    bits.push(s.on ? (s.mode === 'sleep' ? 'Sleep' : `Speed ${s.speed ?? '?'}`) : 'Off');
    if (typeof s.filterLife === 'number') bits.push(`filter ${s.filterLife}%`);
  } else if (t.kind === 'light') {
    bits.push(s.on ? `${s.brightness ?? 100}%` : 'Off');
    if (s.on && s.mode) bits.push(s.mode);
  } else bits.push(s.on ? 'On' : 'Off');
  return bits.join(', ');
}

/** One thing as a tile: name, a fact line, and its switch. Tapping the name opens the thing. */
export function ThingTile({ thing, state }: { thing: Thing; state: ThingState | undefined }) {
  const [error, setError] = useState<string | null>(null);
  const online = Boolean(state?.online);
  const toggle = async (on: boolean) => {
    setError(null);
    try {
      await send(thing, { type: 'power', on });
    } catch (e) {
      setError(plainError(e));
    }
  };
  return (
    <div className={`flex min-h-16 items-center gap-3 rounded-card border bg-card px-3 py-2 ${online ? 'border-line' : 'border-line opacity-60'}`}>
      <span aria-hidden="true" className="emoji text-[26px]">
        {KIND_EMOJI[thing.kind]}
      </span>
      <Link to={`/things/${thing.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{thing.name}</span>
        <span className="block text-[13px] text-muted">
          {error ?? detailLine(thing, state)} · {BRAND_NAMES[thing.brand]}
        </span>
      </Link>
      {thing.caps.includes('power') && thing.kind !== 'vacuum' ? <Switch on={Boolean(state?.on)} label={`${thing.name} on`} onChange={(on) => void toggle(on)} disabled={!online} /> : null}
    </div>
  );
}
