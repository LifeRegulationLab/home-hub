import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Things } from './pages/Things';
import { ThingPage } from './pages/ThingPage';
import { Scenes } from './pages/Scenes';
import { Schedules } from './pages/Schedules';
import { EditSchedule } from './pages/EditSchedule';
import { Dustin } from './pages/Dustin';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="things" element={<Things />} />
          <Route path="things/:id" element={<ThingPage />} />
          <Route path="scenes" element={<Scenes />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="schedules/new" element={<EditSchedule />} />
          <Route path="schedules/:id" element={<EditSchedule />} />
          <Route path="dustin" element={<Dustin />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
