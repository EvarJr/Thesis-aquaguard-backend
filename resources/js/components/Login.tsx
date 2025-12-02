import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, getCurrentUser } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { WaterDropIcon, AlertTriangleIcon } from '@/components/icons/IconComponents';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 🔐 Step 1: Login (sets Sanctum cookie)
      await loginUser(email, password);
      console.info('✅ Login successful, verifying session...');

      // ⏳ Step 2: small delay to ensure cookie sync
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 🔄 Step 3: fetch verified user
      const verifiedUser = await getCurrentUser();
      if (!verifiedUser) throw new Error('Session not established');

      console.info('🎯 Verified user:', verifiedUser);

      // 🧠 Step 4: update global context + localStorage
      localStorage.setItem('user', JSON.stringify(verifiedUser));
      setUser(verifiedUser);

      // 🚀 Step 5: navigate instantly
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('❌ Login failed:', err);
      if (err.response?.status === 401) setError('Invalid email or password.');
      else if (err.response?.status === 419) setError('Session expired. Please refresh and try again.');
      else if (err.response?.status === 500) setError('Server error. Please check backend logs.');
      else setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg transition-colors duration-300">
      <div className="max-w-md w-full bg-brand-surface p-8 rounded-2xl shadow-xl border border-brand-border">
        
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-brand-primary/10 rounded-full mb-4 animate-fade-in-down">
            <WaterDropIcon className="w-12 h-12 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text">AquaGuard</h1>
          <p className="text-brand-muted text-sm mt-2">Water Leakage Prevention System</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-bg border border-brand-border text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
              placeholder="admin@aquaguard.com"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-brand-text mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-bg border border-brand-border text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-lg shadow-md transition-all transform active:scale-[0.98] flex justify-center items-center gap-2 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-brand-muted border-t border-brand-border pt-4">
          &copy; 2025 AquaGuard Inc. Authorized Personnel Only.
        </div>
      </div>
    </div>
  );
};

export default Login;