'use client';

import { AuthContext, type User, type UserRole } from '@/hooks/use-auth';
import { useState, type ReactNode } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const login = (email: string, password: string, role: UserRole) => {
    // In a real app, you'd call Firebase Auth here.
    // For this demo, we'll create a mock user.
    const mockUser: User = {
      uid: 'mock-uid-' + role,
      email,
      nome: role === 'administrador' ? 'Admin Geral' : 'Formador Padrão',
      perfil: role,
    };
    setUser(mockUser);
  };

  const logout = () => {
    // In a real app, you'd call Firebase Auth signOut here.
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
