import { useState } from 'react';
import { useNow } from '../lib/useNow';
import { plainError, send } from '../lib/bridges';
import { PARTS, type Part } from '../lib/model';
import { store, useAppState } from '../lib/store';
import { addClean, lastWeek, partDone, partsDue } from '../lib/vacuum/parts';
import { MODE_WORDS, SUCTION_WORDS, inQuietHours, statusLine } from '../lib/vacuum/status';
import { Button, Card, Field, Notice, Page, PageHeader, Section, Toggle, inputClass } from '../components/ui';

/** The robot's page: one status line, Clean now, quiet hours, parts, history. */
export function Dustin() {
  const state = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [showPicks, setShowPicks] = useState(false);
  const now = useNow();
  const vacuum = state.things.find((t) => t.id === state.vacuum.thingId) ?? state.things.find((t) => t.kind === 'vacuum');
  const s = vacuum ? state.states[vacuum.id] : undefined;
  const v = state.vacuum;
  const hhmm = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const quiet = inQuietHours(hhmm, v.quietFrom, v.quietTo);
  const lowBattery = typeof s?.battery === 'number' && s.battery < v.minBattery;

  if (!vacuum) {
    return (
      <Page>
        <PageHeader title="Robot" line="No robot vacuum found yet. Connect Smart Life in Settings." />
      </Page>
    );
  }

  const go = async (action: 'start' | 'pause' | 'dock' | 'locate' | 'suction' | 'mode', value?: string) => {
    setError(null);
    try {
      if (action === 'start') {
        await send(vacuum, { type: 'vacuum', action: 'suction', value: v.usualSuction });
        await send(vacuum, { type: 'vacuum', action: 'start', ...(value ? { value } : {}) });
        store().update((st) => ({ ...st, vacuum: addClean(st.vacuum, { startedAt: Date.now(), minutes: 0, area: 0, finished: false }) }));
      } else {
        await send(vacuum, { type: 'vacuum', action, ...(value ? { value } : {}) });
      }
    } catch (e) {
      setError(plainError(e));
    }
  };
  const setV = (change: Partial<typeof v>) => store().update((st) => ({ ...st, vacuum: { ...st.vacuum, ...change } }));
  const done = (part: Part) => store().update((st) => ({ ...st, vacuum: partDone(st.vacuum, part) }));
  const week = lastWeek(v.history, now);
  const cleaning = s?.status === 'cleaning';

  return (
    <Page>
      <PageHeader title={vacuum.name} line={statusLine(vacuum.name, s).replace(`${vacuum.name}: `, '')} />
      {error ? <Notice>{error}</Notice> : null}
      {quiet ? <Notice>Quiet hours until {v.quietTo}: schedules wait, but you can still start a clean here.</Notice> : null}
      {lowBattery && !cleaning ? <Notice>Battery {s?.battery}%: under your {v.minBattery}% line, so a scheduled clean would wait until charged.</Notice> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {cleaning ? (
          <Button kind="main" onClick={() => void go('pause')}>
            Pause
          </Button>
        ) : (
          <Button kind="main" onClick={() => void go('start')} onContextMenu={(e) => (e.preventDefault(), setShowPicks(true))}>
            Clean now
          </Button>
        )}
        <Button onClick={() => void go('dock')}>Go home</Button>
        <Button onClick={() => void go('locate')}>Find me</Button>
        <Button onClick={() => setShowPicks((x) => !x)}>More</Button>
      </div>
      {showPicks ? (
        <Card className="mb-4 p-4">
          <p className="mb-2 text-[14px] text-muted">A particular clean</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MODE_WORDS).map(([mode, words]) => (
              <Button key={mode} small onClick={() => void go('start', mode)}>
                {words}
              </Button>
            ))}
          </div>
          <p className="mt-4 mb-2 text-[14px] text-muted">Suction for this clean</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SUCTION_WORDS).map(([k, words]) => (
              <Button key={k} small kind={s?.suction === k ? 'chosen' : 'plain'} onClick={() => void go('suction', k)}>
                {words}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}
      <Section title="Now">
        <Card className="p-4 text-[15px]">
          <p>Battery {typeof s?.battery === 'number' ? `${s.battery}%` : 'unknown'}</p>
          <p>Suction {SUCTION_WORDS[s?.suction ?? ''] ?? s?.suction ?? 'unknown'}</p>
          {s?.water ? <p>Water {s.water}</p> : null}
          {typeof s?.cleanArea === 'number' ? (
            <p>
              Last clean {s.cleanArea} m² in {s.cleanTime ?? '?'} minutes
            </p>
          ) : null}
        </Card>
      </Section>
      <Section title="Parts">
        <Card>
          {partsDue(v).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span>
                <span className="block text-[16px] font-semibold">{p.name}</span>
                <span className="block text-[13px] text-muted">
                  {p.cleansLeft === 0 ? 'Due now' : `About ${p.cleansLeft} cleans left`} · {p.percentUsed}% used · every {PARTS.find((x) => x.id === p.id)?.hours} hours
                </span>
              </span>
              <Button small onClick={() => done(p.id)}>
                Done
              </Button>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[13px] text-muted">Counts hours of cleaning against the maker's intervals. Tap Done when you have emptied or changed one.</p>
      </Section>
      <Section title="This week">
        <Card className="flex items-end gap-2 p-4" aria-label="Cleans each day this week">
          {week.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-accent" style={{ height: `${Math.max(4, Math.min(80, d.minutes))}px`, opacity: d.cleans ? 1 : 0.2 }} />
              <span className="text-[12px] text-muted">{d.day}</span>
            </div>
          ))}
        </Card>
      </Section>
      <Section title="History">
        <Card>
          {v.history.length === 0 ? <p className="px-4 py-3 text-muted">No cleans recorded yet.</p> : null}
          {v.history.slice(0, 20).map((h, i) => (
            <p key={i} className="border-b border-line px-4 py-2 text-[14px] last:border-b-0">
              {new Date(h.startedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} {new Date(h.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: {h.minutes} min,{' '}
              {h.area} m², {h.finished ? 'finished' : 'stopped'}
            </p>
          ))}
        </Card>
      </Section>
      <Section title="Rules">
        <Card>
          <Toggle label="Clean when I'm out" detail="Starts when this phone leaves home; goes home when you are back. Needs location, coming in a later build." on={v.cleanWhenOut} onChange={(on) => setV({ cleanWhenOut: on })} />
          <div className="grid grid-cols-2 gap-3 px-4 pb-3">
            <Field label="Quiet from">
              <input type="time" className={inputClass} value={v.quietFrom} onChange={(e) => setV({ quietFrom: e.target.value })} />
            </Field>
            <Field label="Quiet until">
              <input type="time" className={inputClass} value={v.quietTo} onChange={(e) => setV({ quietTo: e.target.value })} />
            </Field>
            <Field label="Usual suction">
              <select className={inputClass} value={v.usualSuction} onChange={(e) => setV({ usualSuction: e.target.value })}>
                {Object.entries(SUCTION_WORDS).map(([k, w]) => (
                  <option key={k} value={k}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Wait if battery under %">
              <input type="number" min={0} max={100} className={inputClass} value={v.minBattery} onChange={(e) => setV({ minBattery: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        </Card>
      </Section>
    </Page>
  );
}
