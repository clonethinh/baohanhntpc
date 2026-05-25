import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/warrantyService';

const AuthContext = createContext({
  currentStaff: null,
  setCurrentStaff: () => {},
  authLoading: true,
  isAdmin: false,
  login: async () => {},
  logout: async () => {},
  refreshAuth: async () => {},
});

export function AuthProvider({ children }) {
  const [currentStaff, setCurrentStaff] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const res = await authService.me();
      setCurrentStaff(res.data?.data || null);
      return res.data?.data || null;
    } catch {
      setCurrentStaff(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    localStorage.removeItem('ntpc-staff');
    localStorage.removeItem('ntpc-admin-unlocked');
    refreshAuth();
  }, []);

  const login = async (maNV, matKhau) => {
    const res = await authService.login(maNV, matKhau);
    const staff = res.data?.data || null;
    setCurrentStaff(staff);
    return staff;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setCurrentStaff(null);
    }
  };

  const value = {
    currentStaff,
    setCurrentStaff,
    authLoading,
    isAdmin: currentStaff?.role === 'admin',
    login,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
