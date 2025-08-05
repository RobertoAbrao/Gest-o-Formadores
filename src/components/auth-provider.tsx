'use client';

import { AuthContext, type User, type UserRole } from '@/hooks/use-auth';
import { useState, type ReactNode, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User is signed in, let's fetch their profile from Firestore.
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let role: UserRole = 'formador'; // Default role
        let nome: string = 'Usuário';

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Set user details from Firestore document
          role = userData.perfil || 'formador';
          nome = userData.nome || firebaseUser.displayName || (role === 'administrador' ? 'Admin' : 'Formador');
        } else {
            // This case might happen briefly during user creation
            // Or if the user document is missing.
            // We can rely on a temporary role stored during login.
            const tempRole = (localStorage.getItem('userRole') as UserRole) | null;
            if (tempRole) {
                role = tempRole;
            }
            // Use display name or a generic name if not available
            nome = firebaseUser.displayName || (role === 'administrador' ? 'Admin' : 'Formador');
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          nome: nome,
          perfil: role,
        });

      } else {
        // User is signed out
        setUser(null);
        localStorage.removeItem('userRole');
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    setLoading(true);
    // The onAuthStateChanged listener above will handle fetching user data and setting the state.
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    // The onAuthStateChanged listener will handle clearing the user state.
  };

  const assignRole = (role: UserRole) => {
    // This function is now used to temporarily store the selected role
    // during the login process, so onAuthStateChanged can pick it up if needed.
    localStorage.setItem('userRole', role);
  };
  
  // Display a loading indicator while checking auth state
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
