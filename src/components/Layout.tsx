import { NavLink, Outlet } from 'react-router';
import { useEffect } from 'react';
import { refreshAll } from '../lib/bridges';
import { useAppState } from '../lib/store';

const TABS = [
  { to: '/', label: 'Home', emoji: '🏠' },
  { to: '/things', label: 'Things', emoji: '🔌' },
  { to: '/scenes', label: 'Scenes', emoji: '🌙' },
  { to: '/schedules', label: 'Schedules', emoji: '⏰' },
  { to: '/settings', label: 'Settings', emoji: '⚙️' },
];

export function Layout() {
  const state = useAppState();
  // Read every thing when the app opens and each minute while it is open, so Home shows facts.
  useEffect(() => {
    if (state.things.length === 0) return;
    void refreshAll();
    const t = setInterval(() => void refreshAll(), 60_000);
    return () => clearInterval(t);
  }, [state.things.length]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="safe-top" />
      <div className="flex-1">
        <Outlet />
      </div>
      <nav aria-label="Pages" className="safe-bottom sticky bottom-0 z-20 border-t border-line bg-paper">
        <ul className="mx-auto flex max-w-[820px]">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-[13px] leading-tight font-semibold ${isActive ? 'text-accent' : 'text-muted'}`
                }
              >
                <span aria-hidden="true" className="emoji text-[24px]">
                  {t.emoji}
                </span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
