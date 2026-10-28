import { useState } from 'react';
import { useNow } from '../lib/useNow';
import { useNavigate, useParams } from 'react-router';
import { newId, type Command, type Repeat, type Schedule, type When } from '../lib/model';
import { nextRuns } from '../lib/schedules/next';
import { runWords, scheduleSentence } from '../lib/schedules/words';
import { store, useAppState } from '../lib/store';
import { Button, Card, Field, Page, PageHeader, inputClass } from '../components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The sentence builder: [target] [does] at [when] [repeat]. Shows the next runs before you save. */
export function EditSchedule() {
  const { id } = useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const existing = state.schedules.find((s) => s.id === id);
  const firstThing = state.things.find((t) => !t.hidden);
  const [draft, setDraft] = useState<Schedule>(
    existing ?? {
      id: newId('sch'),
      target: firstThing ? { kind: 'thing', id: firstThing.id } : { kind: 'scene', id: state.scenes[0]?.id ?? '' },
      command: { type: 'power', on: true },
      when: { kind: 'time', hhmm: '18:00' },
      repeat: 'daily',
      days: [1, 2, 3, 4, 5],
      enabled: true,
    },
  );
  const now = new Date(useNow());
  const runs = nextRuns(draft, now, state.settings.home, 3);
  const targetKey = `${draft.target.kind}:${draft.target.id}`;
  const targetThing = draft.target.kind === 'thing' ? state.things.find((t) => t.id === draft.target.id) : undefined;

  const setTarget = (key: string) => {
    const [kind, tid] = key.split(':') as ['thing' | 'room' | 'scene', string];
    setDraft((d) => ({ ...d, target: { kind, id: tid }, command: kind === 'scene' ? null : d.command ?? { type: 'power', on: true } }));
  };
  const setWhen = (when: When) => setDraft((d) => ({ ...d, when }));
  const commandOptions: { key: string; words: string; command: Command }[] = [
    { key: 'on', words: 'on', command: { type: 'power', on: true } },
    { key: 'off', words: 'off', command: { type: 'power', on: false } },
  ];
  if (targetThing?.caps.includes('brightness')) {
    for (const v of [20, 40, 60, 80]) commandOptions.push({ key: `b${v}`, words: `to ${v}%`, command: { type: 'brightness', value: v } });
  }
  if (targetThing?.caps.includes('speed')) {
    for (const v of [1, 2, 3]) commandOptions.push({ key: `s${v}`, words: `to speed ${v}`, command: { type: 'speed', value: v } });
    commandOptions.push({ key: 'sleep', words: 'to sleep mode', command: { type: 'mode', value: 'sleep' } });
  }
  if (targetThing?.kind === 'vacuum') {
    commandOptions.length = 0;
    commandOptions.push({ key: 'clean', words: 'cleans', command: { type: 'vacuum', action: 'start' } });
    commandOptions.push({ key: 'dock', words: 'goes home', command: { type: 'vacuum', action: 'dock' } });
  }
  const commandKey = commandOptions.find((o) => JSON.stringify(o.command) === JSON.stringify(draft.command))?.key ?? commandOptions[0]?.key ?? '';

  const save = () => {
    store().update((s) => ({ ...s, schedules: existing ? s.schedules.map((x) => (x.id === draft.id ? draft : x)) : [...s.schedules, draft] }));
    void navigate('/schedules');
  };
  const remove = () => {
    store().update((s) => ({ ...s, schedules: s.schedules.filter((x) => x.id !== draft.id) }));
    void navigate('/schedules');
  };

  return (
    <Page>
      <PageHeader title={existing ? 'Change schedule' : 'New schedule'} />
      <Card className="mb-4 p-4">
        <p className="text-[18px] font-semibold">{scheduleSentence(state, draft)}</p>
        <p className="mt-1 text-[14px] text-muted">
          {draft.when.kind !== 'time' && !state.settings.home ? 'Set your home in Settings for sunrise and sunset' : runs.length ? `Next: ${runs.map((r) => runWords(r, now)).join(', ')}` : 'Will not run'}
        </p>
      </Card>
      <Field label="What">
        <select className={inputClass} value={targetKey} onChange={(e) => setTarget(e.target.value)}>
          <optgroup label="Things">
            {state.things
              .filter((t) => !t.hidden)
              .map((t) => (
                <option key={t.id} value={`thing:${t.id}`}>
                  {t.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="Rooms">
            {state.rooms.map((r) => (
              <option key={r.id} value={`room:${r.id}`}>
                Everything in {r.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Scenes">
            {state.scenes.map((s) => (
              <option key={s.id} value={`scene:${s.id}`}>
                Scene {s.name}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      {draft.target.kind !== 'scene' ? (
        <Field label="Does">
          <select className={inputClass} value={commandKey} onChange={(e) => setDraft((d) => ({ ...d, command: commandOptions.find((o) => o.key === e.target.value)?.command ?? d.command }))}>
            {commandOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.words}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="When">
        <div className="flex gap-2">
          {(['time', 'sunset', 'sunrise'] as const).map((k) => (
            <Button key={k} small kind={draft.when.kind === k ? 'chosen' : 'plain'} onClick={() => setWhen(k === 'time' ? { kind: 'time', hhmm: '18:00' } : { kind: k, offsetMin: 0 })}>
              {k === 'time' ? 'A time' : k === 'sunset' ? 'Sunset' : 'Sunrise'}
            </Button>
          ))}
        </div>
      </Field>
      {draft.when.kind === 'time' ? (
        <Field label="Time">
          <input type="time" className={inputClass} value={draft.when.hhmm} onChange={(e) => setWhen({ kind: 'time', hhmm: e.target.value || '18:00' })} />
        </Field>
      ) : (
        <Field label={`Minutes before or after ${draft.when.kind} (minus is before)`}>
          <input
            type="number"
            step={5}
            className={inputClass}
            value={draft.when.offsetMin}
            onChange={(e) => setWhen({ kind: draft.when.kind === 'sunset' ? 'sunset' : 'sunrise', offsetMin: Number(e.target.value) || 0 })}
          />
        </Field>
      )}
      <Field label="How often">
        <select className={inputClass} value={draft.repeat} onChange={(e) => setDraft((d) => ({ ...d, repeat: e.target.value as Repeat }))}>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekends">Weekends</option>
          <option value="days">Chosen days</option>
          <option value="once">Once</option>
        </select>
      </Field>
      {draft.repeat === 'days' ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {DAYS.map((name, i) => (
            <Button key={name} small kind={draft.days.includes(i) ? 'chosen' : 'plain'} onClick={() => setDraft((d) => ({ ...d, days: d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i].sort() }))}>
              {name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button kind="main" onClick={save}>
          Save
        </Button>
        <Button onClick={() => void navigate('/schedules')}>Cancel</Button>
        {existing ? (
          <Button className="ml-auto" onClick={remove}>
            Remove
          </Button>
        ) : null}
      </div>
    </Page>
  );
}
