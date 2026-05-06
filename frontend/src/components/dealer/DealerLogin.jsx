import React, { useState } from 'react';
import { Calculator, Lock, Loader2, Building2 } from 'lucide-react';
import { dealerLogin } from '../../utils/dealerAuth';

export default function DealerLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const dealer = await dealerLogin(username.trim(), password);
      onSuccess?.(dealer);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#0b1020' }} data-testid="dealer-login-root">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-30" style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 60%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-25" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">WM Saunas · Dealer Portal</div>
            <div className="text-xs text-slate-400">Кабинет дилера</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 shadow-2xl shadow-black/40">
          <h1 className="text-2xl font-bold text-white mb-1">Вход</h1>
          <p className="text-sm text-slate-400 mb-6">Используйте логин и пароль от вашей учётной записи дилера.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Логин</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400 focus:bg-white/10 transition-all"
                placeholder="dealer-login"
                data-testid="dealer-login-username"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Пароль</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400 focus:bg-white/10 transition-all"
                placeholder="••••••••"
                data-testid="dealer-login-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" data-testid="dealer-login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="dealer-login-submit"
              className="w-full py-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Войти в кабинет
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Calculator className="h-3.5 w-3.5" />
          Powered by WM Kalkulator
        </div>
      </div>
    </div>
  );
}
