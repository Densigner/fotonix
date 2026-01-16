import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';

// Firebase config (keep in sync with AuthContext.js)
const firebaseConfig = {
  apiKey: "AIzaSyB9ehjykma-ZIrOavYvhYyZBIc98B73tac",
  authDomain: "fotonix-97544.firebaseapp.com",
  projectId: "fotonix-97544",
  storageBucket: "fotonix-97544.firebasestorage.app",
  // Realtime DB instance (project uses europe-west1 hosted RTDB)
  databaseURL: "https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app",
  messagingSenderId: "1003654054250",
  appId: "1:1003654054250:web:e5c905e6a194f1d4202513",
  measurementId: "G-8B0PPFCRTD"
};

// Initialize Firebase (guard against duplicate initialization)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = firebase.auth();

// Export Realtime Database (project uses Realtime DB for profiles)
export const db = firebase.database();

// Initialize Cloud Storage and get a reference to the service
export const storage = firebase.storage();

export default firebase.app();
