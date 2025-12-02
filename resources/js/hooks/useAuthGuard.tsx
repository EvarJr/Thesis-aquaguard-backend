import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/services/apiService';
import { User } from '@/types';

/**
 * 🔒 Custom Hook: useAuthGuard
 * Protects pages that require authentication.
 * Checks backend session and redirects unauthenticated users to /login.
 */
const useAuthGuard = (user: User | null) => {
  const navigate = useNavigate();

  useEffect(() => {
    const verifySession = async () => {
      try {
        // If user is missing, skip verification and redirect
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        // Check session validity from backend
        const verifiedUser = await getCurrentUser();

        // If backend session expired
        if (!verifiedUser) {
          console.warn('Session expired — redirecting to login');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('AuthGuard: Session validation failed', error);
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
      }
    };

    verifySession();
  }, [user, navigate]);
};

export default useAuthGuard;
