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
import { doc, getDoc, getDocFromCache, setDoc, updateDoc, serverTimestamp, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '@/lib/firebase';
import type { User, UserRole } from '@/types';

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

  // Fetch user profile from Firestore (with offline resilience + retry)
  // Also repairs legacy users who are missing companyId
  const fetchProfile = useCallback(async (uid: string): Promise<User | null> => {
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

    // Try network with retries + exponential backoff (critical for mobile)
    if (!profile) {
      const MAX_RETRIES = 3;
      const BASE_TIMEOUT = 10000; // 10s first attempt

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const timeout = BASE_TIMEOUT + attempt * 5000; // 10s, 15s, 20s
          const networkDoc = await Promise.race([
            getDoc(ref),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Firestore timeout')), timeout)
            ),
          ]);
          if (networkDoc.exists()) {
            profile = { id: networkDoc.id, ...networkDoc.data() } as User;
            break; // Success — stop retrying
          } else {
            break; // Doc doesn't exist — no point retrying
          }
        } catch (error) {
          console.warn(`Profile fetch attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);
          if (attempt < MAX_RETRIES - 1) {
            // Wait before retry: 1s, 2s
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          } else {
            console.error('All profile fetch attempts exhausted');
          }
        }
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


  // Helper: check for pending invitation or create a new company
  const claimInvitationOrCreateCompany = useCallback(
    async (
      uid: string,
      email: string,
      fullName: string
    ): Promise<{ companyId: string; role: UserRole; invitationClaimed: boolean }> => {
      const normalizedEmail = email.toLowerCase().trim();

      try {
        // Query for pending invitations matching this email
        const invitationsQuery = query(
          collection(db, 'invitations'),
          where('email', '==', normalizedEmail),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(invitationsQuery);

        if (!snapshot.empty) {
          // Take the first (most relevant) pending invitation
          const invDoc = snapshot.docs[0];
          const invitation = invDoc.data();

          // Claim the invitation
          await updateDoc(doc(db, 'invitations', invDoc.id), {
            status: 'accepted',
            acceptedByUid: uid,
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          console.log('Invitation claimed for company:', invitation.companyId);
          return {
            companyId: invitation.companyId as string,
            role: (invitation.role as UserRole) || 'standard',
            invitationClaimed: true,
          };
        }
      } catch (error) {
        console.warn('Invitation lookup failed, creating new company:', error);
      }

      // No invitation found — create a new company (existing behavior)
      const companyRef = await addDoc(collection(db, 'companies'), {
        name: `${fullName}'s Company`,
        ownerId: uid,
        plan: 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        companyId: companyRef.id,
        role: 'admin' as UserRole,
        invitationClaimed: false,
      };
    },
    []
  );

  // Helper: create profile for a new Google user
  const createGoogleProfile = useCallback(async (user: FirebaseUser) => {
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const email = user.email || '';

    // Check for pending invitation or create new company
    const { companyId, role } = await claimInvitationOrCreateCompany(
      user.uid,
      email,
      displayName
    );

    await setDoc(doc(db, 'users', user.uid), {
      email,
      fullName: displayName,
      avatarUrl: user.photoURL,
      companyId,
      role,
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
  }, [fetchProfile, claimInvitationOrCreateCompany]);

  // Helper: claim pending invitation for an existing user (moves them to the inviting company)
  const claimInvitationForExistingUser = useCallback(
    async (uid: string, email: string): Promise<User | null> => {
      const normalizedEmail = email.toLowerCase().trim();

      try {
        const invitationsQuery = query(
          collection(db, 'invitations'),
          where('email', '==', normalizedEmail),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(invitationsQuery);

        if (!snapshot.empty) {
          const invDoc = snapshot.docs[0];
          const invitation = invDoc.data();

          // Move user to the inviting company
          await updateDoc(doc(db, 'users', uid), {
            companyId: invitation.companyId,
            role: invitation.role || 'standard',
            updatedAt: serverTimestamp(),
          });

          // Mark invitation as accepted
          await updateDoc(doc(db, 'invitations', invDoc.id), {
            status: 'accepted',
            acceptedByUid: uid,
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          console.log('Existing user claimed invitation for company:', invitation.companyId);

          // Re-fetch the updated profile
          return fetchProfile(uid);
        }
      } catch (error) {
        console.warn('Invitation check for existing user failed:', error);
      }

      return null;
    },
    [fetchProfile]
  );

  // Handle redirect result (for Google sign-in via redirect)
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          let profile = await fetchProfile(result.user.uid);
          if (!profile) {
            profile = await createGoogleProfile(result.user);
          } else if (result.user.email) {
            // Existing user — check for pending invitation
            const updatedProfile = await claimInvitationForExistingUser(result.user.uid, result.user.email);
            if (updatedProfile) {
              profile = updatedProfile;
            }
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
  }, [fetchProfile, createGoogleProfile, claimInvitationForExistingUser]);

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

  // Periodic retry: if user is authenticated but profile is null (mobile network issue),
  // keep retrying every 5 seconds until profile loads
  useEffect(() => {
    if (!state.user || state.profile) return; // Only retry if user exists but profile doesn't
    if (state.isLoading) return; // Don't retry while initial load is in progress

    let cancelled = false;
    let retryCount = 0;
    const MAX_BACKGROUND_RETRIES = 6; // Try for 30 seconds total

    const retry = async () => {
      if (cancelled || retryCount >= MAX_BACKGROUND_RETRIES) return;
      retryCount++;
      console.log(`Background profile retry ${retryCount}/${MAX_BACKGROUND_RETRIES}...`);

      const profile = await fetchProfile(state.user!.uid);
      if (profile && !cancelled) {
        setState((prev) => ({ ...prev, profile }));
        return; // Success — stop retrying
      }

      if (!cancelled && retryCount < MAX_BACKGROUND_RETRIES) {
        setTimeout(retry, 5000);
      }
    };

    // Start first retry after 3 seconds
    const timer = setTimeout(retry, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.user, state.profile, state.isLoading, fetchProfile]);

  // Sign up with email/password
  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // Check for pending invitation or create new company
        const { companyId, role } = await claimInvitationOrCreateCompany(
          user.uid,
          email,
          fullName
        );

        // Create user profile in Firestore keyed by Auth UID
        await setDoc(doc(db, 'users', user.uid), {
          email,
          fullName,
          companyId,
          role,
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
    [fetchProfile, claimInvitationOrCreateCompany]
  );

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      let profile = await fetchProfile(user.uid);

      // If user exists, check for pending invitation to move them to a new company
      if (profile && user.email) {
        const updatedProfile = await claimInvitationForExistingUser(user.uid, user.email);
        if (updatedProfile) {
          profile = updatedProfile;
        }
      }

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
  }, [fetchProfile, claimInvitationForExistingUser]);

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
      } else if (user.email) {
        // Existing user — check for pending invitation
        const updatedProfile = await claimInvitationForExistingUser(user.uid, user.email);
        if (updatedProfile) {
          profile = updatedProfile;
        }
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
  }, [fetchProfile, createGoogleProfile, claimInvitationForExistingUser]);


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
