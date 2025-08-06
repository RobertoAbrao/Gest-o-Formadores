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
        // User is signed in, let's fetch their profile from Firestore.
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
          };
          
          setUser(loggedInUser);
          
          // Redirect after setting user
          const targetPath = role === 'administrador' ? '/dashboard' : '/materiais';
          router.replace(targetPath);

        } else {
            // This case might happen if the user document is not created yet
            // or if there's an error. We log them out to be safe.
            console.error("User document not found in Firestore. Logging out.");
            await signOut(auth);
            setUser(null);
        }

      } else {
        // User is signed out
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    setLoading(true);
    // The onAuthStateChanged listener above will handle fetching user data, setting the state, and redirecting.
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    router.push('/');
  };

  const assignRole = (role: UserRole) => {
    // This function is no longer needed for the login flow.
    // It can be kept if there are other role-assigning functionalities.
  };
  
  // Display a loading indicator while checking auth state
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
