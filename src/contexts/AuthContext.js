import React, { createContext, useContext, useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { API_URL } from '../config/environment';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9ehjykma-ZIrOavYvhYyZBIc98B73tac",
  authDomain: "fotonix-97544.firebaseapp.com",
  projectId: "fotonix-97544",
  storageBucket: "fotonix-97544.firebasestorage.app",
  // IMPORTANT: Realtime Database instance lives in europe-west1 — point to its URL
  databaseURL: "https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app",
  messagingSenderId: "1003654054250",
  appId: "1:1003654054250:web:e5c905e6a194f1d4202513",
  measurementId: "G-8B0PPFCRTD"
};

// Module-scoped placeholders for auth and realtime so they exist for consumers
let auth;
let realtime;

// If running under Jest, provide lightweight stubs so unit tests importing this
// module don't attempt to initialize the real Firebase SDK. Tests can still
// mock or replace these helpers as needed.
if (typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID) {
  auth = {
    createUserWithEmailAndPassword: (email, password) => Promise.resolve({ user: { uid: 'test-uid', email, sendEmailVerification: async () => {} } }),
    signInWithEmailAndPassword: (email, password) => Promise.resolve({ user: { uid: 'test-uid', email } }),
    signInWithPopup: (provider) => Promise.resolve({ user: { uid: 'test-uid', email: 'test@example.com' } }),
    signOut: () => Promise.resolve(),
    sendPasswordResetEmail: (email) => Promise.resolve(),
    onAuthStateChanged: (cb) => {
      // Do not invoke callback in test environment; return unsubscribe
      return () => {};
    },
    onIdTokenChanged: (cb) => {
      return () => {};
    }
  };

  realtime = {
    ref: (path) => ({ set: () => Promise.resolve(), once: () => Promise.resolve({ exists: () => false }), update: () => Promise.resolve() })
  };
} else {
  // Normal browser/runtime: initialize Firebase app and real auth/database
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  auth = firebase.auth();
  realtime = firebase.database();
}

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [postgresUser, setPostgresUser] = useState(null); // PostgreSQL user data
  const [isLoading, setIsLoading] = useState(true);

  // Sync user to PostgreSQL (single source of truth for user data)
  const syncUserToPostgres = async (firebaseUser, options = {}) => {
    try {
      const response = await fetch(`${API_URL}/api/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
          username: options.username || firebaseUser.displayName || '',
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || '',
          signupSource: options.signupSource || 'website',
          isNewUser: options.isNewUser || false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPostgresUser(data.user);
        console.log('✅ User synced to PostgreSQL:', data.user.email, 'State:', data.user.userState);
        return data.user;
      } else {
        console.warn('Failed to sync user to PostgreSQL:', response.status);
      }
    } catch (error) {
      console.warn('Error syncing user to PostgreSQL:', error);
    }
    return null;
  };

  // Signup with email/password
  const signup = async (email, password, options = {}) => {
    const res = await auth.createUserWithEmailAndPassword(email, password);
    // ensure a realtime profile exists
    try {
      const uid = res.user.uid;
      const snap = await realtime.ref(`users/${uid}`).once('value');
      if (!snap.exists()) {
        const rtUser = { 
          email: res.user.email, 
          username: options.username || '',
          createdAt: firebase.database.ServerValue.TIMESTAMP 
        };
        await realtime.ref(`users/${uid}`).set(rtUser);
      }
      // Sync to PostgreSQL
      await syncUserToPostgres(res.user, { 
        username: options.username, 
        signupSource: options.signupSource || 'website',
        isNewUser: true 
      });
    } catch (e) {
      console.warn('Error creating realtime profile during signup', e);
    }
    return res;
  };

  const login = async (email, password) => {
    const result = await auth.signInWithEmailAndPassword(email, password);
    // Ensure a realtime profile exists for users created directly in Firebase Console
    try {
      const snap = await realtime.ref(`users/${result.user.uid}`).once('value');
      if (!snap.exists()) {
        const rtUser = {
          email: result.user.email,
          username: result.user.displayName || result.user.email.split('@')[0],
          createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        await realtime.ref(`users/${result.user.uid}`).set(rtUser);
        console.log('Created missing realtime profile for user:', result.user.uid);
      }
      // Sync to PostgreSQL
      await syncUserToPostgres(result.user, { signupSource: 'website' });
    } catch (e) {
      console.warn('Error checking/creating realtime profile during login', e);
    }
    return result;
  };

  const signInWithGoogle = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    try {
      const snap = await realtime.ref(`users/${result.user.uid}`).once('value');
      const isNew = !snap.exists();
      if (isNew) {
        const rtUser = {
          email: result.user.email,
          username: result.user.displayName || 'Unknown', // Use displayName or 'Unknown' - never derive from email
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        await realtime.ref(`users/${result.user.uid}`).set(rtUser);
      }
      // Sync to PostgreSQL
      await syncUserToPostgres(result.user, { signupSource: 'google', isNewUser: isNew });
    } catch (rtErr) {
      console.warn('Realtime DB check/create failed for Google signup:', rtErr);
    }
    return result;
  };

  const logout = async () => {
    await auth.signOut();
    setUserProfile(null);
  };

  const resetPassword = (email) => auth.sendPasswordResetEmail(email);

  const updateUser = async (data) => {
    if (!currentUser) return;
    try {
      await realtime.ref(`users/${currentUser.uid}`).update({ ...data, updatedAt: firebase.database.ServerValue.TIMESTAMP });
      setUserProfile(prev => ({ ...prev, ...data }));
      setUser(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.warn('updateUser failed:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (uid) => {
    try {
      const snap = await realtime.ref(`users/${uid}`).once('value');
      if (snap.exists()) {
        const profileData = { id: uid, ...snap.val() };
        setUserProfile(profileData);
        setUser(profileData);
        return profileData;
      }
    } catch (error) {
      if (error && error.code === 'PERMISSION_DENIED') {
        console.warn('Realtime DB permission denied for user profile. Ensure user is logged in or rules allow access.');
        return null;
      }
      console.error('Error fetching user profile from Realtime DB:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser) {
        try { sessionStorage.setItem('fotonix_uid', firebaseUser.uid); } catch (e) {}
        await fetchUserProfile(firebaseUser.uid);
        // Sync to PostgreSQL on every auth state change (ensures user exists in DB)
        await syncUserToPostgres(firebaseUser, { signupSource: 'session-restore' });
      } else {
        try { sessionStorage.removeItem('fotonix_uid'); } catch (e) {}
        setUser(null);
        setUserProfile(null);
        setPostgresUser(null);
      }

      setIsLoading(false);
    });

    const tokenUnsub = auth.onIdTokenChanged(async (tokenUser) => {
      if (tokenUser) {
        await fetchUserProfile(tokenUser.uid);
      }
    });

    return () => {
      try { unsubscribe(); } catch (e) {}
      try { tokenUnsub(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    user,
    currentUser,
    userProfile,
    postgresUser, // PostgreSQL user data (single source of truth)
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUser,
    fetchUserProfile,
    syncUserToPostgres
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
