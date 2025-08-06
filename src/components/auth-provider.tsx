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
import { useRouter } from 'next/navigation';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        if(user && user.uid === firebaseUser.uid) {
          // User data is already loaded, no need to fetch again.
          // This prevents state updates on re-login during user creation.
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.perfil || 'formador';
          const nome = userData.nome || firebaseUser.displayName || (role === 'administrador' ? 'Admin' : 'Formador');

          const loggedInUser: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nome: nome,
            perfil: role,
            // Keep admin password from previous state if available
            adminPassword: user?.perfil === 'administrador' ? user.adminPassword : undefined,
          };
          
          setUser(loggedInUser);
          
          const targetPath = role === 'administrador' ? '/dashboard' : '/materiais';
          if (window.location.pathname !== targetPath && !window.location.pathname.startsWith('/formadores')) {
             router.replace(targetPath);
          }

        } else {
            console.error("User document not found in Firestore. Logging out.");
            await signOut(auth);
            setUser(null);
        }

      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, user]);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    setLoading(true);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.perfil === 'administrador') {
        // Store the password in the user object ONLY for admins
        setUser(prevUser => ({
          ...prevUser,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          nome: userData.nome,
          perfil: 'administrador',
          adminPassword: password, // <-- Here is the critical change
        }));
      }
    }
    
    return userCredential;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    router.push('/');
  };

  const assignRole = (role: UserRole) => {
    // This function is no longer needed for the login flow.
  };
  
  if (loading && !user) {
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
