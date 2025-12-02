import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';
import { getCurrentUser } from '@/services/apiService';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  loading: true,
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * ✅ Refresh authenticated user from backend (or clear if invalid)
   */
  const refreshUser = async () => {
    try {
      const current = await getCurrentUser();
      if (current && current.id) {
        setUser(current);
        localStorage.setItem('user', JSON.stringify(current));
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }
    } catch {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  /**
   * 🧠 Rehydrate session on app start
   * 1️⃣ Try restoring from localStorage
   * 2️⃣ Fallback to getCurrentUser() if no local cache
   */
  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) {
            setUser(parsed);
          } else {
            await refreshUser();
          }
        } else {
          await refreshUser();
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
