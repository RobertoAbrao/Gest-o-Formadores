'use client';

import { AuthContext, type User, type UserRole } from '@/hooks/use-auth';
import { useState, type ReactNode, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let role: UserRole = 'formador'; // Default role
        let nome: string = 'Usuário';

        if (userDoc.exists()) {
          const userData = userDoc.data();
          role = userData.perfil || 'formador';
          nome = userData.nome || firebaseUser.displayName || (role === 'administrador' ? 'Admin' : 'Formador');
        } else {
            // Fallback for when user doc doesn't exist yet
            const tempRole = (localStorage.getItem('userRole') as UserRole) || 'formador';
            role = tempRole;
            nome = firebaseUser.displayName || (role === 'administrador' ? 'Admin' : 'Formador');
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          nome: nome,
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
    // This is now primarily a fallback for the login page,
    // as the authoritative role comes from Firestore.
    localStorage.setItem('userRole', role);
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
