import { useState } from 'react';
import { sendMany } from '../lib/bridges';
import { sceneFromNow, stepWords } from '../lib/scenes';
import { store, useAppState } from '../lib/store';
import { Button, Card, Field, Page, PageHeader, inputClass } from '../components/ui';

/** One tap sets many things. A scene is made from how the house is now. */
export function Scenes() {
  const state = useAppState();
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const run = async (id: string) => {
    const scene = state.scenes.find((s) => s.id === id);
    if (!scene) return;
    const errors = await sendMany(scene.steps);
    setNote(errors.length ? errors.join('. ') : `${scene.name} set`);
  };
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const scene = sceneFromNow(state, n);
    store().update((s) => ({ ...s, scenes: [...s.scenes, scene] }));
    setName('');
    setNote(`${n} saved from how the house is now`);
  };
  const remove = (id: string) => store().update((s) => ({ ...s, scenes: s.scenes.filter((x) => x.id !== id) }));

  return (
    <Page>
      <PageHeader title="Scenes" line="One tap sets many things." />
      {note ? <p className="mb-3 text-[14px] text-muted">{note}</p> : null}
      {state.scenes.map((scene) => (
        <Card key={scene.id} className="mb-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">{scene.name}</h2>
            <Button kind="main" small onClick={() => void run(scene.id)}>
              Set
            </Button>
          </div>
          <ul className="mt-2 text-[14px] text-muted">
            {scene.steps.map((st, i) => (
              <li key={i}>{stepWords(state.things.find((t) => t.id === st.thingId), st.command)}</li>
            ))}
          </ul>
          <Button small className="mt-3" onClick={() => remove(scene.id)}>
            Remove
          </Button>
        </Card>
      ))}
      <Card className="p-4">
        <h2 className="mb-2 text-[16px] font-semibold">Save how the house is now</h2>
        <p className="mb-3 text-[14px] text-muted">Set every thing how you want it, give it a name, and it becomes a scene.</p>
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bedtime" />
        </Field>
        <Button kind="main" onClick={save} disabled={!name.trim()}>
          Save as scene
        </Button>
      </Card>
    </Page>
  );
}
