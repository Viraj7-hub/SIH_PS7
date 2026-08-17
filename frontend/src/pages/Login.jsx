import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShipWheel } from 'lucide-react';
import { login } from '../services/api';

const initialState = {
  email: 'demo@oceanroute.com',
  password: 'demo123',
};

const DEFAULT_SHIP = {
  shipId: 'SHIP001',
  shipName: 'Ocean Star',
  source: 'Mumbai Port',
  destination: 'Port of Colombo',
  currentPosition: { lat: 18.9388, lon: 72.8354 },
  destinationPosition: { lat: 6.9271, lon: 79.8612 },
  speed: 18.2,
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Extract token + role from both API response shapes:
   *   New:    { success: true, token, user: { role } }
   *   Legacy: { token, user: { email, name, role } }
   */
  const extractAuth = (payload) => {
    const token    = payload?.token || payload?.data?.token;
    const userRole = payload?.user?.role || payload?.data?.user?.role || 'crew';
    return { token, userRole };
  };

  const handleLoginSuccess = (token, userRole) => {
    localStorage.setItem('oceanroute_token', token);
    localStorage.setItem('oceanroute_role', userRole);

    if (userRole === 'captain') {
      navigate('/ship-select');
    } else {
      if (!localStorage.getItem('oceanroute_ship')) {
        localStorage.setItem('oceanroute_ship', JSON.stringify(DEFAULT_SHIP));
      }
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!emailOk || !form.password) {
      setError('Invalid email or password.');
      return;
    }

    try {
      setLoading(true);
      const response = await login({ email: form.email, password: form.password });
      const { token, userRole } = extractAuth(response.data);
      if (!token) throw new Error('No token received');
      handleLoginSuccess(token, userRole);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    try {
      setLoading(true);
      const response = await login({ email: 'crew@oceanroute.com', password: 'demo123' });
      const { token, userRole } = extractAuth(response.data);
      if (!token) throw new Error('No token received');
      handleLoginSuccess(token, userRole);
    } catch (err) {
      setError(err.response?.data?.message || 'Demo login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#0b2440_0%,#020817_45%,#01060d_100%)] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-[30px] border border-slate-700/70 bg-slate-900/80 p-7 shadow-[0_30px_80px_rgba(2,6,23,0.6)] backdrop-blur-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-cyan-300">
          <span className="text-3xl">🚢</span>
          <span className="text-2xl font-semibold">OceanRoute</span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white">Welcome Aboard</h1>
          <p className="mt-2 text-slate-300">Your intelligent voyage companion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Email</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                placeholder="demo@oceanroute.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">Password</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3">
              <LockKeyhole className="h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-400">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-white disabled:opacity-70"
          >
            <ShipWheel className="h-4 w-4" />
            Continue as Demo Passenger
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center text-xs text-slate-400 space-y-1">
          <div><span className="font-semibold text-cyan-400">Captain Login:</span> demo@oceanroute.com</div>
          <div><span className="font-semibold text-slate-300">Crew/Passenger:</span> crew@oceanroute.com</div>
          <div>Password: <span className="font-medium text-slate-200">demo123</span></div>
        </div>
      </div>
    </div>
  );
}
