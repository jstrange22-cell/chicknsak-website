import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ user: FirebaseUser; profile: User | null }>;
  signIn: (email: string, password: string) => Promise<{ user: FirebaseUser; profile: User | null }>;
  signInWithGoogle: () => Promise<{ user: FirebaseUser; profile: User | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<User | null> | undefined;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
