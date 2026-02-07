import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, setDoc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '@/lib/firebase';
import type { User } from '@/types';

interface AuthState {
  user: FirebaseUser | null;
  profile: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Fetch user profile from Firestore (with offline resilience)
  // Also repairs legacy users who are missing companyId
  const fetchProfile = useCallback(async (uid: string) => {
    const ref = doc(db, 'users', uid);

    let profile: User | null = null;

    // Try cache first for instant offline loads
    try {
      const cached = await getDocFromCache(ref);
      if (cached.exists()) {
        // Also kick off a background network fetch to refresh the data
        getDoc(ref).catch(() => {/* ignore network errors */});
        profile = { id: cached.id, ...cached.data() } as User;
      }
    } catch {
      // No cached doc, fall through to network
    }

    // Try network with a timeout so the app doesn't hang forever
    if (!profile) {
      try {
        const networkDoc = await Promise.race([
          getDoc(ref),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 8000)
          ),
        ]);
        if (networkDoc.exists()) {
          profile = { id: networkDoc.id, ...networkDoc.data() } as User;
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
    }

    // Legacy user repair: if profile exists but has no companyId, auto-create a company
    if (profile && !profile.companyId) {
      try {
        const companyRef = await addDoc(collection(db, 'companies'), {
          name: `${profile.fullName}'s Company`,
          ownerId: uid,
          plan: 'free',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(ref, {
          companyId: companyRef.id,
          updatedAt: serverTimestamp(),
        });

        profile = { ...profile, companyId: companyRef.id };
        console.log('Legacy user repaired: created company', companyRef.id);
      } catch (error) {
        console.error('Failed to repair legacy user:', error);
      }
    }

    return profile;
  }, []);


  // Helper: create profile for a new Google user
  const createGoogleProfile = useCallback(async (user: FirebaseUser) => {
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';

    const companyRef = await addDoc(collection(db, 'companies'), {
      name: `${displayName}'s Company`,
      ownerId: user.uid,
      plan: 'free',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      fullName: displayName,
      avatarUrl: user.photoURL,
      companyId: companyRef.id,
      role: 'admin',
      isActive: true,
      notificationSettings: {
        email: true,
        push: true,
        sms: false,
        photoUploads: true,
        comments: true,
        mentions: true,
        taskAssignments: true,
      },
      settings: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return fetchProfile(user.uid);
  }, [fetchProfile]);

  // Handle redirect result (for Google sign-in via redirect)
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          let profile = await fetchProfile(result.user.uid);
          if (!profile) {
            profile = await createGoogleProfile(result.user);
          }
          setState({
            user: result.user,
            profile,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
        }
      })
      .catch((error) => {
        console.error('Redirect sign-in error:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Google sign in failed',
        }));
      });
  }, [fetchProfile, createGoogleProfile]);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await fetchProfile(user.uid);
        setState({
          user,
          profile,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  // Sign up with email/password
  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // Auto-create a company for the new user (they are the owner/admin)
        const companyRef = await addDoc(collection(db, 'companies'), {
          name: `${fullName}'s Company`,
          ownerId: user.uid,
          plan: 'free',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Create user profile in Firestore with companyId
        await setDoc(doc(db, 'users', user.uid), {
          email,
          fullName,
          companyId: companyRef.id,
          role: 'admin', // Company creator is admin
          isActive: true,
          notificationSettings: {
            email: true,
            push: true,
            sms: false,
            photoUploads: true,
            comments: true,
            mentions: true,
            taskAssignments: true,
          },
          settings: {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const profile = await fetchProfile(user.uid);
        setState({
          user,
          profile,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        
        return { user, profile };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Signup failed';
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        throw error;
      }
    },
    [fetchProfile]
  );


  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchProfile(user.uid);
      setState({
        user,
        profile,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      return { user, profile };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, [fetchProfile]);

  // Sign in with Google
  // - Native (Capacitor on Android/iOS): use redirect only (popups crash the WebView)
  // - Web: try popup first, fallback to redirect if popup is blocked
  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    const provider = new GoogleAuthProvider();

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // On Capacitor native, signInWithRedirect works correctly because the
      // WebView uses the custom URL scheme (androidScheme: 'https') and
      // Capacitor intercepts the redirect back to the app.
      // signInWithPopup would crash the app by trying to open a new window.
      console.log('Native platform detected, using redirect sign-in');
      try {
        await signInWithRedirect(auth, provider);
        // The page will redirect away; result is handled by getRedirectResult
        // in the useEffect above when the app resumes.
        return null;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Google sign in failed';
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        throw error;
      }
    }

    // Web: try popup first (works on desktop when popups are allowed)
    try {
      const { user } = await signInWithPopup(auth, provider);

      let profile = await fetchProfile(user.uid);
      if (!profile) {
        profile = await createGoogleProfile(user);
      }

      setState({
        user,
        profile,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

      return { user, profile };
    } catch (popupError: unknown) {
      // If popup was blocked or failed, fall back to redirect
      const errorCode = (popupError as { code?: string })?.code;
      if (
        errorCode === 'auth/popup-blocked' ||
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request'
      ) {
        console.log('Popup blocked, falling back to redirect sign-in');
        // Redirect will navigate away; state handled by getRedirectResult on return
        await signInWithRedirect(auth, provider);
        return null;
      }

      // Some other error
      const errorMessage = popupError instanceof Error ? popupError.message : 'Google sign in failed';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw popupError;
    }
  }, [fetchProfile, createGoogleProfile]);


  // Sign out
  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await firebaseSignOut(auth);
      setState({
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await sendPasswordResetEmail(auth, email);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    clearError,
    refreshProfile: async () => {
      if (!state.user) return null;
      const profile = await fetchProfile(state.user.uid);
      setState((prev) => ({
        ...prev,
        profile,
      }));
      return profile;
    },
  };
}
