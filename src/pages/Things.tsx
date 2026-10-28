import { Link } from 'react-router';
import { BRAND_NAMES, type Brand } from '../lib/model';
import { useAppState } from '../lib/store';
import { KIND_EMOJI, detailLine } from '../components/ThingTile';
import { Page, PageHeader, Section } from '../components/ui';

/** Every device from every brand, grouped by room, with hidden ones at the end. */
export function Things() {
  const state = useAppState();
  const rooms = [...state.rooms].sort((a, b) => a.order - b.order);
  const noRoom = state.things.filter((t) => !t.hidden && t.rooms.length === 0);
  const hidden = state.things.filter((t) => t.hidden);
  const brands = (Object.keys(BRAND_NAMES) as Brand[]).filter((b) => state.things.some((t) => t.brand === b));

  const Row = ({ id }: { id: string }) => {
    const t = state.things.find((x) => x.id === id);
    if (!t) return null;
    return (
      <Link to={`/things/${t.id}`} className="flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
        <span aria-hidden="true" className="emoji text-[22px]">
          {KIND_EMOJI[t.kind]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{t.name}</span>
          <span className="block text-[13px] text-muted">
            {detailLine(t, state.states[t.id])} · {BRAND_NAMES[t.brand]}
          </span>
        </span>
        <span className="text-[14px] text-muted">›</span>
      </Link>
    );
  };

  return (
    <Page>
      <PageHeader title="Things" line={`${state.things.length} from ${brands.map((b) => BRAND_NAMES[b]).join(', ') || 'no brand yet'}`} />
      {rooms.map((r) => {
        const in_ = state.things.filter((t) => !t.hidden && t.rooms.includes(r.id));
        if (in_.length === 0) return null;
        return (
          <Section key={r.id} title={`${r.name} (${in_.length})`}>
            <div className="rounded-card border border-line bg-card">
              {in_.map((t) => (
                <Row key={t.id} id={t.id} />
              ))}
            </div>
          </Section>
        );
      })}
      {noRoom.length ? (
        <Section title={`No room yet (${noRoom.length})`}>
          <div className="rounded-card border border-line bg-card">
            {noRoom.map((t) => (
              <Row key={t.id} id={t.id} />
            ))}
          </div>
        </Section>
      ) : null}
      {hidden.length ? (
        <Section title={`Hidden (${hidden.length})`}>
          <div className="rounded-card border border-line bg-card opacity-70">
            {hidden.map((t) => (
              <Row key={t.id} id={t.id} />
            ))}
          </div>
        </Section>
      ) : null}
      {state.things.length === 0 ? <p className="text-muted">Connect a brand in Settings to find its things.</p> : null}
    </Page>
  );
}
