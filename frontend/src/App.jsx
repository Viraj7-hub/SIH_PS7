import { Navigate, Route, Routes } from 'react-router-dom';
import Login          from './pages/Login';
import ShipSelect     from './pages/ShipSelect';
import Dashboard      from './pages/Dashboard';
import NautilusRouter from './pages/NautilusRouter';

const DEFAULT_SHIP = {
  shipId: 'SHIP001',
  shipName: 'Ocean Star',
  source: 'Mumbai Port',
  destination: 'Port of Colombo',
  currentPosition: { lat: 18.9388, lon: 72.8354 },
  destinationPosition: { lat: 6.9271, lon: 79.8612 },
  speed: 18.2,
};

/**
 * Route protection for /login:
 * Always starts at /login if not authenticated.
 * If authenticated, redirects to appropriate destination based on role.
 */
function GuestRoute({ children }) {
  const token = localStorage.getItem('oceanroute_token');
  const role = localStorage.getItem('oceanroute_role');
  const ship = localStorage.getItem('oceanroute_ship');

  if (token) {
    if (role === 'captain' && !ship) {
      return <Navigate to="/ship-select" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Route protection for Captain-only /ship-select ("Choose Ship"):
 * Unauthenticated → /login
 * Authenticated Non-Captain → /dashboard (no access to Choose Ship)
 * Authenticated Captain → Allow
 */
function CaptainShipSelectRoute({ children }) {
  const token = localStorage.getItem('oceanroute_token');
  const role = localStorage.getItem('oceanroute_role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'captain') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Route protection for /dashboard and /nautilus:
 * Unauthenticated → /login
 * Authenticated Captain without ship → /ship-select
 * Authenticated Non-Captain without ship → Auto-assign default ship & Allow
 */
function ProtectedAppRoute({ children }) {
  const token = localStorage.getItem('oceanroute_token');
  const role = localStorage.getItem('oceanroute_role');
  const ship = localStorage.getItem('oceanroute_ship');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!ship) {
    if (role === 'captain') {
      return <Navigate to="/ship-select" replace />;
    }
    // Auto-assign default ship for non-captain roles
    localStorage.setItem('oceanroute_ship', JSON.stringify(DEFAULT_SHIP));
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login"       element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/ship-select" element={<CaptainShipSelectRoute><ShipSelect /></CaptainShipSelectRoute>} />
      <Route path="/dashboard"   element={<ProtectedAppRoute><Dashboard /></ProtectedAppRoute>} />
      <Route path="/nautilus"    element={<ProtectedAppRoute><NautilusRouter /></ProtectedAppRoute>} />
      <Route path="*"            element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
