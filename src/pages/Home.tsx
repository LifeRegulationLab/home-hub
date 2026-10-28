import { useState } from 'react';
import { useNow } from '../lib/useNow';
import { Link } from 'react-router';
import { sendMany } from '../lib/bridges';
import { countOn, thingsInRoom, type Room, type State } from '../lib/model';
import { roomCommands } from '../lib/scenes';
import { useAppState } from '../lib/store';
import { statusLine } from '../lib/vacuum/status';
import { ThingTile } from '../components/ThingTile';
import { Button, Card, Page, Switch } from '../components/ui';

function RoomCard({ room, state }: { room: Room; state: State }) {
  const things = thingsInRoom(state, room.id).filter((t) => t.kind !== 'vacuum');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (things.length === 0) return null;
  const anyOn = things.some((t) => state.states[t.id]?.on && state.states[t.id]?.online);
  const switchRoom = async (on: boolean) => {
    setBusy(true);
    setError(null);
    const errors = await sendMany(roomCommands(things, on));
    setError(errors[0] ?? null);
    setBusy(false);
  };
  return (
    <Card className="mb-4 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="text-[20px] font-bold">{room.name}</h2>
        <Switch on={anyOn} label={`Everything in ${room.name}`} onChange={(on) => void switchRoom(on)} disabled={busy} />
      </div>
      {error ? <p className="mb-2 px-1 text-[14px] text-muted">{error}</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        {things.map((t) => (
          <ThingTile key={t.id} thing={t} state={state.states[t.id]} />
        ))}
      </div>
    </Card>
  );
}

export function Home() {
  const state = useAppState();
  const counts = countOn(state);
  const vacuum = state.things.find((t) => t.id === state.vacuum.thingId) ?? state.things.find((t) => t.kind === 'vacuum');
  const [sceneError, setSceneError] = useState<string | null>(null);
  const now = useNow();
  const rooms = [...state.rooms].sort((a, b) => a.order - b.order);
  const quick = state.scenes.slice(0, 3);
  const hubAgo = state.hubSeenAt ? Math.round((now - state.hubSeenAt) / 60_000) : null;

  const allOff = async () => {
    const steps = roomCommands(
      state.things.filter((t) => !t.hidden),
      false,
    );
    const errors = await sendMany(steps);
    setSceneError(errors[0] ?? null);
  };
  const runScene = async (id: string) => {
    const scene = state.scenes.find((s) => s.id === id);
    if (!scene) return;
    const errors = await sendMany(scene.steps);
    setSceneError(errors[0] ?? null);
  };

  if (state.things.length === 0) {
    return (
      <Page>
        <h1 className="text-[30px] font-bold">Home</h1>
        <p className="mt-2 text-[16px] text-muted">Nothing here yet. Connect a brand in Settings and its things appear in their rooms.</p>
        <Link to="/settings" className="mt-4 inline-block rounded-button bg-ink px-5 py-3 font-semibold text-on-ink">
          Open Settings
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-[30px] font-bold">Home</h1>
        <p className="text-[14px] text-muted">
          {counts.on} on{counts.offline ? `, ${counts.offline} not answering` : ''}
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button kind="main" onClick={() => void allOff()}>
          All off
        </Button>
        {quick.map((s) => (
          <Button key={s.id} onClick={() => void runScene(s.id)}>
            {s.name}
          </Button>
        ))}
      </div>
      {sceneError ? <p className="mb-3 text-[14px] text-muted">{sceneError}</p> : null}
      {vacuum ? (
        <Link to="/dustin" className="mb-4 block rounded-card border border-line bg-card px-4 py-3">
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="emoji text-[26px]">
              🤖
            </span>
            <span className="flex-1 text-[16px] font-semibold">{statusLine(vacuum.name, state.states[vacuum.id])}</span>
            <span className="text-[14px] text-accent">Open</span>
          </span>
        </Link>
      ) : null}
      {rooms.map((r) => (
        <RoomCard key={r.id} room={r} state={state} />
      ))}
      <p className="text-[13px] text-muted">
        {state.settings.hub === 'this' ? 'This device is the hub' : 'Another device is the hub'}
        {hubAgo !== null ? `, schedules last checked ${hubAgo < 1 ? 'just now' : `${hubAgo} min ago`}` : ''}.
      </p>
    </Page>
  );
}
