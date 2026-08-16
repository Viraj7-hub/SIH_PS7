import { Navigate, Route, Routes } from 'react-router-dom';
import Login          from './pages/Login';
import ShipSelect     from './pages/ShipSelect';
import Dashboard      from './pages/Dashboard';
import NautilusRouter from './pages/NautilusRouter';

function ProtectedShipRoute({ children }) {
  const token = localStorage.getItem('oceanroute_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ProtectedDashboardRoute({ children }) {
  const token = localStorage.getItem('oceanroute_token');
  const ship = localStorage.getItem('oceanroute_ship');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!ship) {
    return <Navigate to="/ship-select" replace />;
  }

  return children;
}

function GuestRoute({ children }) {
  const token = localStorage.getItem('oceanroute_token');

  if (token) {
    return <Navigate to="/ship-select" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login"      element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/ship-select" element={<ProtectedShipRoute><ShipSelect /></ProtectedShipRoute>} />
      <Route path="/dashboard"  element={<ProtectedDashboardRoute><Dashboard /></ProtectedDashboardRoute>} />
      {/* Nautilus Route Optimizer — requires auth but no ship selection */}
      <Route path="/nautilus"   element={<ProtectedShipRoute><NautilusRouter /></ProtectedShipRoute>} />
      <Route path="*"           element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;

