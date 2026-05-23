import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({
  currentStaff: null,
  setCurrentStaff: () => {},
  adminUnlocked: false,
  setAdminUnlocked: () => {},
});

export function AuthProvider({ children }) {
  const [currentStaff, setCurrentStaff] = useState(() => {
    try {
      const saved = localStorage.getItem('ntpc-staff');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [adminUnlocked, setAdminUnlocked] = useState(() => localStorage.getItem('ntpc-admin-unlocked') === '1');

  useEffect(() => {
    if (currentStaff) {
      localStorage.setItem('ntpc-staff', JSON.stringify(currentStaff));
    } else {
      localStorage.removeItem('ntpc-staff');
      setAdminUnlocked(false);
    }
  }, [currentStaff]);

  useEffect(() => {
    if (adminUnlocked) localStorage.setItem('ntpc-admin-unlocked', '1');
    else localStorage.removeItem('ntpc-admin-unlocked');
  }, [adminUnlocked]);

  return (
    <AuthContext.Provider value={{ currentStaff, setCurrentStaff, adminUnlocked, setAdminUnlocked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
