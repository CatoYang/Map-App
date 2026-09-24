import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { RequireAuth } from './auth.jsx';
import { Landing } from '../pages/Landing.jsx';
import { Login } from '../pages/Login.jsx';
import { Privacy } from '../pages/Privacy.jsx';
import { Campaigns } from '../pages/Campaigns.jsx';
import { CampaignHome } from '../pages/CampaignHome.jsx';
import { Join } from '../pages/Join.jsx';

// Loaded on demand so other pages don't download Leaflet and the map code
const MapPage = lazy(() => import('../pages/MapPage.jsx').then(m => ({ default: m.MapPage })));
const loading = <Center h="100vh"><Loader /></Center>;

/** All routes. See docs/architecture.md §7 for the full plan. */
export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Signed-in only */}
      <Route element={<RequireAuth />}>
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/c/:campaignId" element={<CampaignHome />} />
        <Route path="/c/:campaignId/map/:mapId" element={<Suspense fallback={loading}><MapPage /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
