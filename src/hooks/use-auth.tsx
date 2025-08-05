'use client';

import { createContext, useContext } from 'react';

export type UserRole = 'administrador' | 'formador';

export interface User {
  uid: string;
  email: string | null;
  nome: string | null;
  perfil: UserRole;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  assignRole: (role: UserRole) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  assignRole: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
