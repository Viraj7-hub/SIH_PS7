import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShipWheel } from 'lucide-react';
import { login } from '../services/api';

const initialState = {
  email: 'demo@oceanroute.com',
  password: 'demo123',
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
<<<<<<< Updated upstream
      localStorage.setItem('oceanroute_token', response.data.token);
      navigate('/ship-select');
=======
      // New API: { success: true, data: { token, user: { role } } }
      // Legacy:  { token, user: { email, name } }
      const payload = response.data;
      const token = payload.data?.token || payload.token;
      const userRole = payload.data?.user?.role || role;
      localStorage.setItem('oceanroute_token', token);
      localStorage.setItem('oceanroute_role', userRole);
      navigate('/nautilus');
>>>>>>> Stashed changes
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

<<<<<<< Updated upstream
  const handleDemoLogin = () => {
    localStorage.setItem('oceanroute_token', 'demo-token');
    navigate('/ship-select');
=======
  const handleDemoLogin = async () => {
    setError('');
    try {
      setLoading(true);
      const response = await login({ email: 'demo@oceanroute.com', password: 'demo123' });
      const { token, data } = response.data;
      // Support both new { success, data: { token } } and legacy { token } shape
      const actualToken = token || data?.token;
      const actualRole  = data?.user?.role || role;
      localStorage.setItem('oceanroute_token', actualToken);
      localStorage.setItem('oceanroute_role', actualRole);
      navigate('/nautilus');
    } catch (err) {
      setError(err.response?.data?.message || 'Demo login failed. Please try again.');
    } finally {
      setLoading(false);
    }
>>>>>>> Stashed changes
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-white"
          >
            <ShipWheel className="h-4 w-4" />
            Continue as Demo Passenger
          </button>
        </form>
      </div>
    </div>
  );
}
