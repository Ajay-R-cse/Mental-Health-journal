import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  updatePassword as updateFirebasePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { User } from '../types';
import { auth, db, googleProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, pass: string, confirm: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  verifyIdentity: (password?: string) => Promise<boolean>;
  authProvider: 'google' | 'password';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);

          // Retrieve or initialize user profile document in Firestore
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          let profileName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Mindful User';

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            profileName = data.displayName || data.name || profileName;
            setUser({
              id: fbUser.uid,
              name: profileName,
              email: fbUser.email || '',
              created_at: data.createdAt || data.created_at || new Date().toISOString(),
            });
          } else {
            const now = new Date().toISOString();
            const initialDoc = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: profileName,
              createdAt: now,
            };
            await setDoc(userDocRef, initialDoc, { merge: true });
            setUser({
              id: fbUser.uid,
              name: profileName,
              email: fbUser.email || '',
              created_at: now,
            });
          }
        } catch (err) {
          console.error('Error synchronizing Firebase user profile:', err);
          setUser({
            id: fbUser.uid,
            name: fbUser.displayName || 'Mindful User',
            email: fbUser.email || '',
            created_at: new Date().toISOString(),
          });
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      let msg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try again in a few moments.';
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const seedDemoDataIfEmpty = async (uid: string) => {
    try {
      const q = query(collection(db, 'journalEntries'), where('userId', '==', uid));
      const existing = await getDocs(q);
      if (!existing.empty) return; // already seeded

      const now = new Date();
      const format = (daysAgo: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
      };

      const seedJournals = [
        {
          userId: uid,
          date: format(0),
          journalText: 'Took a morning walk through the botanical gardens. The morning light and fresh air brought such a deep sense of clarity, gratitude, and peace before starting my work.',
          mood: 'Very Happy',
          sleepHours: 8.0,
          sentiment: 'Positive',
          sentimentScore: 8.5,
          emotionalKeywords: ['grateful', 'peaceful', 'clarity', 'light'],
          activities: ['Morning Walk', 'Mindful Breathing', 'Hydration'],
          tags: ['grateful', 'calm', 'nature'],
          createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          userId: uid,
          date: format(1),
          journalText: 'Completed my quarterly project presentation. Felt calm and grounded throughout the meeting. Celebrated with an evening yoga flow and chamomile tea.',
          mood: 'Happy',
          sleepHours: 7.5,
          sentiment: 'Positive',
          sentimentScore: 6.0,
          emotionalKeywords: ['calm', 'grounded', 'accomplished', 'relaxed'],
          activities: ['Yoga', 'Team Reflection', 'Chamomile Tea'],
          tags: ['productive', 'calm'],
          createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 26 * 3600000).toISOString(),
        },
        {
          userId: uid,
          date: format(2),
          journalText: 'Slightly tired after travel, but practiced 15 minutes of box breathing. Felt my heart rate stabilize and mind quiet down. Ready for good sleep.',
          mood: 'Neutral',
          sleepHours: 7.0,
          sentiment: 'Neutral',
          sentimentScore: 1.0,
          emotionalKeywords: ['rest', 'breathing', 'quiet'],
          activities: ['Box Breathing', 'Reading'],
          tags: ['rest', 'mindfulness'],
          createdAt: new Date(Date.now() - 50 * 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 50 * 3600000).toISOString(),
        },
      ];

      for (const item of seedJournals) {
        await addDoc(collection(db, 'journalEntries'), item);
      }

      // Seed sleep records
      const seedSleep = [
        { userId: uid, date: format(0), sleepHours: 8.0, notes: 'Restful, deep sleep without waking', createdAt: new Date().toISOString() },
        { userId: uid, date: format(1), sleepHours: 7.5, notes: 'Fell asleep smoothly after yoga', createdAt: new Date().toISOString() },
        { userId: uid, date: format(2), sleepHours: 7.0, notes: 'Box breathing before bed helped calm thoughts', createdAt: new Date().toISOString() },
      ];
      for (const s of seedSleep) {
        await addDoc(collection(db, 'sleepRecords'), s);
      }

      // Seed activities
      const seedActs = [
        { userId: uid, activityName: 'Morning Walk', duration: 30, date: format(0), createdAt: new Date().toISOString() },
        { userId: uid, activityName: 'Box Breathing', duration: 15, date: format(0), createdAt: new Date().toISOString() },
        { userId: uid, activityName: 'Yoga', duration: 45, date: format(1), createdAt: new Date().toISOString() },
      ];
      for (const a of seedActs) {
        await addDoc(collection(db, 'activities'), a);
      }

      // Seed initial insight
      await addDoc(collection(db, 'insights'), {
        userId: uid,
        title: 'Morning Reflections & Restful Sleep',
        description: 'Logging 7.5+ hours of sleep strongly correlates with elevated optimism and radiant mood ratings across your entries.',
        type: 'correlation',
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Demo data seeding notice:', e);
    }
  };

  const loginAsDemo = async () => {
    setIsLoading(true);
    const demoEmail = 'alex.demo@wellness.com';
    const demoPass = 'Wellness2026!';

    try {
      const cred = await signInWithEmailAndPassword(auth, demoEmail, demoPass);
      await seedDemoDataIfEmpty(cred.user.uid);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
          await updateFirebaseProfile(newCred.user, { displayName: 'Alex Morgan' });
          await setDoc(doc(db, 'users', newCred.user.uid), {
            uid: newCred.user.uid,
            email: demoEmail,
            displayName: 'Alex Morgan',
            createdAt: new Date().toISOString(),
          });
          await seedDemoDataIfEmpty(newCred.user.uid);
        } catch (createErr: any) {
          throw new Error(createErr.message || 'Failed to initialize demo account');
        }
      } else {
        throw new Error(err.message || 'Failed to sign in to demo account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      // Update or create Firestore user document
      const userDocRef = doc(db, 'users', fbUser.uid);
      await setDoc(
        userDocRef,
        {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Mindful User',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      throw new Error(err.message || 'Google Sign-In was cancelled or encountered an issue');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string, confirm: string) => {
    if (pass !== confirm) {
      throw new Error('Passwords do not match.');
    }
    if (pass.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const fbUser = cred.user;

      await updateFirebaseProfile(fbUser, { displayName: name.trim() });

      const now = new Date().toISOString();
      await setDoc(doc(db, 'users', fbUser.uid), {
        uid: fbUser.uid,
        email: email.trim(),
        displayName: name.trim(),
        createdAt: now,
      });

      setUser({
        id: fbUser.uid,
        name: name.trim(),
        email: email.trim(),
        created_at: now,
      });
    } catch (err: any) {
      let msg = 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account already exists with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  const updateProfile = async (name: string, _email: string) => {
    if (!auth.currentUser) return;
    await updateFirebaseProfile(auth.currentUser, { displayName: name.trim() });
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { displayName: name.trim(), updatedAt: new Date().toISOString() },
      { merge: true }
    );
    setUser((prev) => (prev ? { ...prev, name: name.trim() } : null));
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      throw new Error('No authenticated user session.');
    }
    const credential = EmailAuthProvider.credential(fbUser.email, currentPass);
    await reauthenticateWithCredential(fbUser, credential);
    await updateFirebasePassword(fbUser, newPass);
  };

  const verifyIdentity = async (password?: string): Promise<boolean> => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error('No authenticated user session found.');
    }

    const isGoogle = fbUser.providerData.some((p) => p.providerId === 'google.com');

    if (isGoogle) {
      try {
        await reauthenticateWithPopup(fbUser, googleProvider);
        return true;
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user') {
          throw new Error('Google re-authentication was cancelled.');
        }
        throw new Error(err.message || 'Google re-authentication failed.');
      }
    } else {
      if (!password || !password.trim()) {
        throw new Error('Please enter your account password to verify your identity.');
      }
      if (!fbUser.email) {
        throw new Error('No email found for account verification.');
      }
      try {
        const credential = EmailAuthProvider.credential(fbUser.email, password.trim());
        await reauthenticateWithCredential(fbUser, credential);
        return true;
      } catch (err: any) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          throw new Error('Incorrect password. Please try again.');
        }
        throw new Error(err.message || 'Password verification failed.');
      }
    }
  };

  const authProvider: 'google' | 'password' =
    auth.currentUser?.providerData.some((p) => p.providerId === 'google.com')
      ? 'google'
      : 'password';

  // 15-minute inactivity timeout (900,000 ms) auto-logout
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 900,000 ms (15 minutes)
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const trackedEvents = ['mousemove', 'keydown', 'scroll'] as const;
    trackedEvents.forEach((evt) => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    // Start timer on mount or when user changes
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      trackedEvents.forEach((evt) => {
        window.removeEventListener(evt, resetTimer);
      });
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        authProvider,
        login,
        loginAsDemo,
        loginWithGoogle,
        register,
        logout,
        updateProfile,
        changePassword,
        verifyIdentity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
