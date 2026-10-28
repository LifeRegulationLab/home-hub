import { useEffect, useState, type ReactNode } from 'react';
import { discover, resetBridges } from '../lib/bridges';
import { BRAND_NAMES, type Brand, newId } from '../lib/model';
import { getSecret, setSecret, type SecretKey } from '../lib/secrets';
import { inShell, isTablet } from '../lib/shell';
import { store, useAppState } from '../lib/store';
import { Button, Card, Field, Notice, Page, PageHeader, Section, Toggle, inputClass } from '../components/ui';

function Dot({ ok }: { ok: boolean }) {
  return <span aria-label={ok ? 'connected' : 'not connected'} className={`inline-block size-3 rounded-full ${ok ? 'bg-accent' : 'bg-line'}`} />;
}

function BrandCard({ brand, fields, note, children }: { brand: Brand; fields: { key: SecretKey; label: string; secret?: boolean }[]; note: string; children?: ReactNode }) {
  const state = useAppState();
  const status = state.brands[brand];
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all(fields.map(async (f) => [f.key, (await getSecret(f.key)) ?? ''] as const)).then((pairs) => setValues(Object.fromEntries(pairs)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);
  const saveAndTest = async () => {
    setBusy(true);
    setResult(null);
    for (const f of fields) await setSecret(f.key, values[f.key]?.trim() || null);
    if (brand === 'vesync') {
      await setSecret('vesync.token', null);
      await setSecret('vesync.accountId', null);
    }
    if (brand === 'tuya') await setSecret('tuya.token', null);
    resetBridges();
    const r = await discover(brand);
    setResult(r.error ? r.error : `Found ${r.count} ${r.count === 1 ? 'thing' : 'things'}`);
    setBusy(false);
  };
  return (
    <Card className="mb-4 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[18px] font-bold">{BRAND_NAMES[brand]}</h2>
        <Dot ok={status.connected} />
      </div>
      <p className="mb-3 text-[14px] text-muted">{note}</p>
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          <input
            className={inputClass}
            type={f.secret ? 'password' : 'text'}
            autoCapitalize="none"
            autoCorrect="off"
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </Field>
      ))}
      {children}
      <div className="flex items-center gap-3">
        <Button kind="main" small onClick={() => void saveAndTest()} disabled={busy}>
          {busy ? 'Testing' : fields.length ? 'Save and find things' : 'Find things'}
        </Button>
        <span className="text-[14px] text-muted">{result ?? status.lastError ?? (status.lastOk ? `Last worked ${new Date(status.lastOk).toLocaleString('en-GB')}` : '')}</span>
      </div>
    </Card>
  );
}

export function Settings() {
  const state = useAppState();
  const [roomName, setRoomName] = useState('');
  const set = (change: Partial<typeof state.settings>) => store().update((s) => ({ ...s, settings: { ...s.settings, ...change } }));
  const addRoom = () => {
    const n = roomName.trim();
    if (!n) return;
    store().update((s) => ({ ...s, rooms: [...s.rooms, { id: newId('room'), name: n, order: s.rooms.length }] }));
    setRoomName('');
  };
  const removeRoom = (id: string) =>
    store().update((s) => ({ ...s, rooms: s.rooms.filter((r) => r.id !== id), things: s.things.map((t) => ({ ...t, rooms: t.rooms.filter((r) => r !== id) })) }));
  const useHere = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => set({ home: { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 } }));
  };
  const copySetup = async () => {
    const keys: SecretKey[] = ['tuya.accessId', 'tuya.accessSecret', 'govee.apiKey', 'vesync.email', 'vesync.password'];
    const secrets = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSecret(k)])));
    const text = JSON.stringify({ homehub: 1, secrets, state: { rooms: state.rooms, things: state.things, scenes: state.scenes, schedules: state.schedules, vacuum: state.vacuum, settings: state.settings } });
    await navigator.clipboard.writeText(text);
  };
  const pasteSetup = async () => {
    try {
      const parsed = JSON.parse(await navigator.clipboard.readText()) as { homehub?: number; secrets?: Record<string, string | null>; state?: Partial<typeof state> };
      if (parsed.homehub !== 1) return;
      for (const [k, v] of Object.entries(parsed.secrets ?? {})) await setSecret(k as SecretKey, v);
      store().update((s) => ({ ...s, ...(parsed.state ?? {}), settings: { ...s.settings, ...(parsed.state?.settings ?? {}), hub: 'other' } }));
      resetBridges();
    } catch {
      // Not a Home hub setup on the clipboard: nothing changes.
    }
  };

  return (
    <Page>
      <PageHeader title="Settings" />
      <Section title="Brands">
        <BrandCard
          brand="tuya"
          note="The Gosund plugs and the robot, through the Smart Life app and a free Tuya developer project. Keys from the project's Overview page."
          fields={[
            { key: 'tuya.accessId', label: 'Access ID' },
            { key: 'tuya.accessSecret', label: 'Access Secret', secret: true },
          ]}
        >
          <Field label="Data centre">
            <select className={inputClass} value={state.settings.tuyaRegion} onChange={(e) => (set({ tuyaRegion: e.target.value as typeof state.settings.tuyaRegion }), resetBridges())}>
              <option value="eu">Central Europe</option>
              <option value="us">Western America</option>
              <option value="in">India</option>
              <option value="cn">China</option>
            </select>
          </Field>
        </BrandCard>
        <BrandCard brand="govee" note="Govee lights. The key comes from Govee Home: Me, Settings, Apply for API Key." fields={[{ key: 'govee.apiKey', label: 'API key', secret: true }]} />
        <BrandCard
          brand="vesync"
          note="The Levoit purifiers, with your VeSync sign-in. Kept in this device's keychain."
          fields={[
            { key: 'vesync.email', label: 'Email' },
            { key: 'vesync.password', label: 'Password', secret: true },
          ]}
        />
        <BrandCard brand="wiz" note={inShell() ? 'WiZ bulbs on this Wi-Fi. Nothing to type: the app finds them.' : 'WiZ bulbs answer only from the phone app on the home Wi-Fi.'} fields={[]} />
      </Section>
      <Section title="Rooms">
        <Card>
          {state.rooms.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-line px-4 py-2 last:border-b-0">
              <span className="text-[16px]">{r.name}</span>
              <Button small onClick={() => removeRoom(r.id)}>
                Remove
              </Button>
            </div>
          ))}
          <div className="flex gap-2 p-3">
            <input className={inputClass} placeholder="New room" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            <Button small onClick={addRoom}>
              Add
            </Button>
          </div>
        </Card>
      </Section>
      <Section title="The hub">
        <Card>
          <Toggle
            label="This device runs the schedules"
            detail={isTablet() ? 'The iPad is the best hub: keep Home hub open on it at home.' : 'On for the one device that stays at home with the app open, usually the iPad.'}
            on={state.settings.hub === 'this'}
            onChange={(on) => set({ hub: on ? 'this' : 'other' })}
          />
          <div className="px-4 pb-3">
            <p className="text-[14px] text-muted">
              Home for sunrise and sunset: {state.settings.home ? `${state.settings.home.lat}, ${state.settings.home.lon}` : 'not set'}
            </p>
            <Button small className="mt-2" onClick={useHere}>
              Use where I am now
            </Button>
          </div>
        </Card>
      </Section>
      <Section title="Copy to the other device">
        <Card className="p-4">
          <p className="mb-3 text-[14px] text-muted">Copy puts the keys, rooms, things, scenes and schedules on the clipboard. Paste on the iPad (or phone) through iCloud's shared clipboard, then press Paste there.</p>
          <div className="flex gap-2">
            <Button small onClick={() => void copySetup()}>
              Copy setup
            </Button>
            <Button small onClick={() => void pasteSetup()}>
              Paste setup
            </Button>
          </div>
        </Card>
      </Section>
      <Section title="Look">
        <Card>
          <Field label="Theme">
            <div className="flex gap-2 px-4 pt-2">
              {(['auto', 'light', 'dark'] as const).map((t) => (
                <Button key={t} small kind={state.settings.theme === t ? 'chosen' : 'plain'} onClick={() => set({ theme: t })}>
                  {t === 'auto' ? 'Follow the device' : t === 'light' ? 'Light' : 'Dark'}
                </Button>
              ))}
            </div>
          </Field>
          <Toggle label="Large text" on={state.settings.bigText} onChange={(on) => set({ bigText: on })} />
        </Card>
      </Section>
      {!inShell() ? <Notice>This is the web version. Keys typed here stay in this browser; the phone app keeps them in the keychain.</Notice> : null}
    </Page>
  );
}
