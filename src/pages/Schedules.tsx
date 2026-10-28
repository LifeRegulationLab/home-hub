import { Link } from 'react-router';
import { useNow } from '../lib/useNow';
import { nextRuns } from '../lib/schedules/next';
import { runWords, scheduleSentence } from '../lib/schedules/words';
import { store, useAppState } from '../lib/store';
import { Button, Card, Page, PageHeader, Switch } from '../components/ui';

/** Every timer in the house as one sentence each, with the next three times it will run. */
export function Schedules() {
  const state = useAppState();
  const now = new Date(useNow());
  const setEnabled = (id: string, enabled: boolean) => store().update((s) => ({ ...s, schedules: s.schedules.map((x) => (x.id === id ? { ...x, enabled } : x)) }));

  return (
    <Page>
      <PageHeader
        title="Schedules"
        line="One sentence each. Under it, when it will next run."
        right={
          <Link to="/schedules/new" className="rounded-button bg-ink px-4 py-3 font-semibold text-on-ink">
            Add
          </Link>
        }
      />
      {state.schedules.length === 0 ? <p className="text-muted">No schedules yet. Add one: a thing, what it does, when, and how often.</p> : null}
      {state.schedules.map((s) => {
        const runs = s.enabled ? nextRuns(s, now, state.settings.home, 3) : [];
        const needsPlace = s.when.kind !== 'time' && !state.settings.home;
        return (
          <Card key={s.id} className="mb-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/schedules/${s.id}`} className="flex-1">
                <span className="block text-[17px] font-semibold">{scheduleSentence(state, s)}</span>
                <span className="block text-[14px] text-muted">
                  {needsPlace ? 'Set your home in Settings for sunrise and sunset' : s.enabled ? (runs.length ? runs.map((r) => runWords(r, now)).join(', ') : 'Will not run again') : 'Paused'}
                </span>
                <span className="block text-[13px] text-muted">
                  {s.pushedTo ? `Held by ${s.pushedTo}, runs with the phone off` : 'Run by the hub device'}
                  {s.lastRun ? ` · ran ${runWords(new Date(s.lastRun), now).toLowerCase()}` : ''}
                </span>
              </Link>
              <Switch on={s.enabled} label="Schedule on" onChange={(on) => setEnabled(s.id, on)} />
            </div>
          </Card>
        );
      })}
      {state.schedules.length ? (
        <p className="mt-2 text-[13px] text-muted">
          Schedules marked as run by the hub device need Home hub open on the iPad (or this device) at that time.{' '}
          <Button small className="ml-1" onClick={() => void import('../lib/schedules/runner').then((m) => m.tick(new Date()))}>
            Check now
          </Button>
        </p>
      ) : null}
    </Page>
  );
}
