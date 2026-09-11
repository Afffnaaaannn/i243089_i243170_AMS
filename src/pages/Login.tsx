import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { Boxes, Lock, Mail, ArrowRight, User } from 'lucide-react';

export const Login: React.FC = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login, register } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isRegistering && !fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (isRegistering && !username.trim()) {
      setErrorMessage('Please choose a username.');
      return;
    }

    if (!usernameOrEmail.trim()) {
      setErrorMessage('Please enter your username or university email.');
      error('Please complete all required fields.', 'Validation Error');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your account password.');
      error('Password cannot be empty.', 'Validation Error');
      return;
    }

    setIsSubmitting(true);
    const result: { success: boolean; error?: string; requiresConfirmation?: boolean } = isRegistering
      ? await register({ fullName, username, email: usernameOrEmail, password })
      : await login(usernameOrEmail, password);
    setIsSubmitting(false);

    if (result.success) {
      if (isRegistering && result.requiresConfirmation) {
        success('Account created. Check your email to confirm your account.', 'Confirm Your Email');
        setIsRegistering(false);
        return;
      }
      success(isRegistering ? 'Account created. Welcome to UniAsset AMS!' : 'Logged in successfully. Welcome to UniAsset AMS!', 'Authentication Successful');
      navigate(from, { replace: true });
    } else {
      setErrorMessage(result.error || 'Invalid credentials. Please verify and retry.');
      error(result.error || 'Authentication failed.', 'Login Error');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full">
        
        {/* Left column: Login Form */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/30">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{isRegistering ? 'Create your account' : 'Welcome back'}</h1>
              <p className="text-xs text-slate-500">Asset Management System</p>
            </div>
          </div>

          {errorMessage && (
            <div role="alert" className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <div className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 font-bold">!</div>
              <div>
                <p className="font-semibold">Authentication Error</p>
                <p className="text-xs text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Full name</label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Username</label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition" />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {isRegistering ? 'Email address' : 'Username or university email'}
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder={isRegistering ? 'you@example.com' : 'you@example.com or username'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-600/20 hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Authenticating session...</span>
              ) : (
                <>
                  <span>{isRegistering ? 'Create account' : 'Sign in'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setErrorMessage(''); }} className="w-full mt-5 text-sm font-medium text-brand-600 hover:text-brand-700 transition">
            {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>

      </div>
    </div>
  );
};
