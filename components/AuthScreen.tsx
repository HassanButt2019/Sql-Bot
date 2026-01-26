import React, { useState } from 'react';
import { loginUser, registerUser, storeAuthToken } from '../services/authService';

interface AuthScreenProps {
  onAuthenticated: (user: any) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    company: '',
    role: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = mode === 'login'
        ? await loginUser({ email: form.email, password: form.password })
        : await registerUser({
            email: form.email,
            password: form.password,
            name: form.name,
            company: form.company,
            role: form.role
          });
      if (!result.success || !result.data?.token) {
        throw new Error(result.error || 'Authentication failed.');
      }
      storeAuthToken(result.data.token);
      onAuthenticated(result.data.user);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">S</div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">SQLMind</h2>
            <p className="text-xs text-slate-500">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 bg-slate-100 rounded-2xl p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            type="button"
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            type="button"
          >
            Register
          </button>
        </div>

        {error && <div className="mb-4 text-xs font-semibold text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
                className="w-full p-4 rounded-2xl border border-slate-200 text-sm"
              />
              <input
                value={form.company}
                onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Company"
                className="w-full p-4 rounded-2xl border border-slate-200 text-sm"
              />
              <input
                value={form.role}
                onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Role"
                className="w-full p-4 rounded-2xl border border-slate-200 text-sm"
              />
            </>
          )}
          <input
            value={form.email}
            onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            className="w-full p-4 rounded-2xl border border-slate-200 text-sm"
          />
          <input
            value={form.password}
            onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Password"
            type="password"
            className="w-full p-4 rounded-2xl border border-slate-200 text-sm"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black"
          >
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
