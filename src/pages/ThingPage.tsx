import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { plainError, send } from '../lib/bridges';
import { WIZ_SCENES } from '../lib/bridges/wiz';
import { BRAND_NAMES, type Command } from '../lib/model';
import { store, useAppState } from '../lib/store';
import { Button, Card, Field, Page, PageHeader, Section, Switch, Toggle, inputClass } from '../components/ui';
import { detailLine } from '../components/ThingTile';

/** One thing: its controls, then its name, rooms and whether it shows on Home. */
export function ThingPage() {
  const { id } = useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const thing = state.things.find((t) => t.id === id);
  if (!thing) {
    return (
      <Page>
        <p>That thing is not here any more.</p>
        <Link to="/things">Back to Things</Link>
      </Page>
    );
  }
  const s = state.states[thing.id];
  const online = Boolean(s?.online);
  const go = async (c: Command) => {
    setError(null);
    try {
      await send(thing, c);
    } catch (e) {
      setError(plainError(e));
    }
  };
  const rename = (name: string) => store().update((st) => ({ ...st, things: st.things.map((t) => (t.id === thing.id ? { ...t, name } : t)) }));
  const toggleRoom = (roomId: string) =>
    store().update((st) => ({
      ...st,
      things: st.things.map((t) => (t.id === thing.id ? { ...t, rooms: t.rooms.includes(roomId) ? t.rooms.filter((r) => r !== roomId) : [...t.rooms, roomId] } : t)),
    }));
  const setHidden = (hidden: boolean) => store().update((st) => ({ ...st, things: st.things.map((t) => (t.id === thing.id ? { ...t, hidden } : t)) }));
  const forget = () => {
    store().update((st) => ({ ...st, things: st.things.filter((t) => t.id !== thing.id) }));
    void navigate('/things');
  };

  return (
    <Page>
      <PageHeader title={thing.name} line={`${detailLine(thing, s)} · ${BRAND_NAMES[thing.brand]}`} />
      {error ? <p className="mb-3 rounded-card bg-notice px-4 py-3 text-[15px]">{error}</p> : null}
      {thing.kind === 'vacuum' ? (
        <Link to="/dustin" className="mb-4 inline-block rounded-button bg-ink px-5 py-3 font-semibold text-on-ink">
          Open the robot's page
        </Link>
      ) : (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[18px] font-semibold">{s?.on ? 'On' : 'Off'}</span>
            <Switch on={Boolean(s?.on)} label={`${thing.name} on`} onChange={(on) => void go({ type: 'power', on })} disabled={!online} />
          </div>
          {thing.caps.includes('brightness') ? (
            <label className="mt-4 block">
              <span className="text-[14px] text-muted">Brightness {s?.brightness ?? 100}%</span>
              <input
                type="range"
                min={1}
                max={100}
                defaultValue={s?.brightness ?? 100}
                className="mt-1 w-full accent-[var(--accent)]"
                onMouseUp={(e) => void go({ type: 'brightness', value: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => void go({ type: 'brightness', value: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => void go({ type: 'brightness', value: Number((e.target as HTMLInputElement).value) })}
              />
            </label>
          ) : null}
          {thing.caps.includes('temperature') ? (
            <div className="mt-4">
              <span className="text-[14px] text-muted">White</span>
              <div className="mt-1 flex gap-2">
                {[
                  ['Warm', 2700],
                  ['Soft', 3500],
                  ['Daylight', 5000],
                  ['Cool', 6500],
                ].map(([name, k]) => (
                  <Button key={String(name)} small kind={s?.temperature === k ? 'chosen' : 'plain'} onClick={() => void go({ type: 'temperature', kelvin: Number(k) })}>
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {thing.caps.includes('colour') ? (
            <label className="mt-4 flex items-center gap-3">
              <span className="text-[14px] text-muted">Colour</span>
              <input
                type="color"
                className="h-11 w-20"
                defaultValue={s?.colour ? `#${[s.colour.r, s.colour.g, s.colour.b].map((v) => v.toString(16).padStart(2, '0')).join('')}` : '#ffb060'}
                onChange={(e) => {
                  const v = e.target.value;
                  void go({ type: 'colour', r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16) });
                }}
              />
            </label>
          ) : null}
          {thing.caps.includes('scene') && thing.brand === 'wiz' ? (
            <Field label="Mode">
              <select className={inputClass} value="" onChange={(e) => e.target.value && void go({ type: 'scene', id: e.target.value })}>
                <option value="">Choose a mode</option>
                {Object.entries(WIZ_SCENES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {thing.caps.includes('speed') ? (
            <div className="mt-4">
              <span className="text-[14px] text-muted">Speed</span>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3].map((n) => (
                  <Button key={n} small kind={s?.on && s.mode !== 'sleep' && s.speed === n ? 'chosen' : 'plain'} onClick={() => void go({ type: 'speed', value: n })}>
                    {n}
                  </Button>
                ))}
                <Button small kind={s?.on && s.mode === 'sleep' ? 'chosen' : 'plain'} onClick={() => void go({ type: 'mode', value: 'sleep' })}>
                  Sleep
                </Button>
              </div>
            </div>
          ) : null}
          {thing.caps.includes('display') ? <Toggle label="Display light" on={Boolean(s?.display)} onChange={(on) => void go({ type: 'display', on })} /> : null}
          {thing.caps.includes('lock') ? <Toggle label="Child lock" on={Boolean(s?.lock)} onChange={(on) => void go({ type: 'lock', on })} /> : null}
          {typeof s?.filterLife === 'number' ? <p className="mt-3 text-[14px] text-muted">Filter life {s.filterLife}%</p> : null}
        </Card>
      )}
      <Section title="Name and rooms">
        <Field label="Name">
          <input className={inputClass} defaultValue={thing.name} onBlur={(e) => rename(e.target.value.trim() || thing.name)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {state.rooms.map((r) => (
            <Button key={r.id} small kind={thing.rooms.includes(r.id) ? 'chosen' : 'plain'} onClick={() => toggleRoom(r.id)}>
              {r.name}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">A thing can be in more than one room.</p>
      </Section>
      <Section title="Showing">
        <Card>
          <Toggle label="Hide from Home" detail="Still in Things; not on Home or in room switches" on={thing.hidden} onChange={setHidden} />
        </Card>
      </Section>
      <Section title="Details">
        <p className="text-[14px] text-muted">
          {BRAND_NAMES[thing.brand]} id {thing.externalId}
          {Object.entries(thing.meta)
            .filter(([, v]) => v)
            .map(([k, v]) => ` · ${k} ${v}`)
            .join('')}
        </p>
        <Button small className="mt-3" onClick={forget}>
          Forget this thing
        </Button>
      </Section>
    </Page>
  );
}
