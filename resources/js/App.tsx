import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './lib/echo'; 
import { LanguageProvider } from '@/i18n';
import { ThemeProvider } from '@/context/ThemeContext'; // ✅ Import ThemeProvider
import { WaterDropIcon } from '@/components/icons/IconComponents';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Dashboard from '@/components/Dashboard';
import Login from '@/components/Login';
import { logoutUser } from '@/services/apiService';
import useGlobalAlerts from '@/hooks/useGlobalAlerts';

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg transition-colors duration-300">
    <WaterDropIcon className="w-16 h-16 text-brand-primary animate-pulse" />
    <p className="mt-4 text-brand-text font-semibold">Initializing AquaGuard...</p>
  </div>
);

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const MainRoutes: React.FC = () => {
  const { user, setUser, loading } = useAuth();
  useGlobalAlerts();

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard user={user!} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    {/* ✅ Wrap with ThemeProvider */}
    <ThemeProvider>
      <BrowserRouter basename="/">
        <AuthProvider>
          <MainRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </LanguageProvider>
);

export default App;