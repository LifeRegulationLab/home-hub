import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { showcaseRequested, showcaseState } from './lib/showcase';
import { setStore, store } from './lib/store';
import { startRunner } from './lib/schedules/runner';
import './index.css';

const params = new URLSearchParams(window.location.search);
const showcase = showcaseRequested(window.location.search);
if (showcase) setStore(showcaseState());

// The screenshot job asks for a theme in the address; otherwise the choice in Settings.
const asked = params.get('theme');
const applyLook = () => {
  const { bigText, theme } = store().get().settings;
  const root = document.documentElement;
  root.dataset['big'] = String(bigText);
  const chosen = asked === 'light' || asked === 'dark' ? asked : theme;
  if (chosen === 'auto') delete root.dataset['theme'];
  else root.dataset['theme'] = chosen;
};
applyLook();
store().subscribe(applyLook);
if (!showcase) startRunner();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
