'use client';

import { AuthContext, type User, type UserRole } from '@/hooks/use-auth';
import { useState, type ReactNode, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // NOTE: In a real app, the role would be fetched from a database (like Firestore)
        // based on the user's UID. Here we keep it in localStorage for simplicity.
        const role = (localStorage.getItem('userRole') as UserRole) || 'formador';
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          nome: firebaseUser.displayName || (role === 'administrador' ? 'Admin' : 'Formador'),
          perfil: role,
        });
      } else {
        setUser(null);
        localStorage.removeItem('userRole');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    await signInWithEmailAndPassword(auth, email, password);
    // The onAuthStateChanged listener will handle setting the user state.
  };

  const logout = async () => {
    await signOut(auth);
    // The onAuthStateChanged listener will handle clearing the user state.
  };

  const assignRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, perfil: role });
      localStorage.setItem('userRole', role);
    } else {
      // If user is not logged in yet, store role for when they do.
      localStorage.setItem('userRole', role);
    }
  };
  
  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, assignRole }}>
      {children}
    </AuthContext.Provider>
  );
}
