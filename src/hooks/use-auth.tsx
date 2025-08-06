'use client';

import { createContext, useContext } from 'react';
import type { UserCredential } from 'firebase/auth';

export type UserRole = 'administrador' | 'formador';

export interface User {
  uid: string;
  email: string | null;
  nome: string | null;
  perfil: UserRole;
  // This is a temporary solution to re-login admin after creating a user.
  // In a real-world scenario, this should be handled by a backend service.
  adminPassword?: string; 
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  assignRole: (role: UserRole) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => { throw new Error('Login function not implemented'); },
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
