// Firebase-backed storage helpers for MailBuilder onboarding.
// This file uses the modular Firebase SDK through the `init` wrapper which
// attempts to reuse the app-level `src/firebase.js` exports. If Firebase is
// not configured, the functions fall back to demo behavior so the UI still works.

import { auth, db, storage } from './init';

// Lazy load modular SDK functions only when needed to keep the initial bundle small.
async function ensureFirebase() {
  const hasStorage = storage !== null && storage !== undefined;
  const hasDb = db !== null && db !== undefined;
  return { hasStorage, hasDb };
}

export async function uploadThemeAsset(fileOrRef, userId, subfolder = 'assets') {
  // Accept either a File/Blob or an existing remote reference object { url }
  const info = await ensureFirebase();
  if (!info.hasStorage) {
    // Demo fallback: create an object URL for preview and return a fake path
    // Use the project's storage bucket name so demo gsPaths match production form.
    const name = fileOrRef && fileOrRef.name ? fileOrRef.name : (fileOrRef && fileOrRef.url ? fileOrRef.url.split('/').pop() : `asset-${Date.now()}`);
    const downloadURL = (typeof window !== 'undefined' && fileOrRef instanceof Blob) ? URL.createObjectURL(fileOrRef) : (fileOrRef && fileOrRef.url) || '';
    const bucket = 'fotonix-97544.firebasestorage.app';
    return { downloadURL, gsPath: `gs://${bucket}/${userId}/${subfolder}/${name}`, storagePath: `${userId}/${subfolder}/${name}` };
  }

  // Real Firebase Storage upload flow (modular SDK)
  // We lazy-import storage functions so bundlers only include them if used.
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');

  // If caller passed an already-uploaded url ref, just return it
  if (fileOrRef && fileOrRef.url && typeof fileOrRef.url === 'string') {
    return { downloadURL: fileOrRef.url, gsPath: fileOrRef.url, storagePath: fileOrRef.url };
  }

  const filename = fileOrRef && fileOrRef.name ? fileOrRef.name : `asset-${Date.now()}`;
  const storagePath = `${userId}/${subfolder}/${filename}`;
  const storageRef = ref(storage, storagePath);

  // uploadBytes accepts a Blob/File
  const snapshot = await uploadBytes(storageRef, fileOrRef);
  const downloadURL = await getDownloadURL(snapshot.ref);
  // Prefer a canonical gs:// path using the known project bucket. If that's not desired,
  // the `downloadURL` is always authoritative for accessing the file.
  const bucketName = 'fotonix-97544.firebasestorage.app';
  return { downloadURL, gsPath: `gs://${bucketName}/${storagePath}`, storagePath };
}

export async function saveThemeManifest(userId, manifest) {
  const info = await ensureFirebase();
  if (!info.hasDb) {
    // Demo fallback: save to localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = `mailbuilder:theme:${userId}`;
        window.localStorage.setItem(key, JSON.stringify(manifest));
        return { ok: true, key };
      }
    } catch (e) {
      // ignore
    }
    return { ok: true };
  }

  // Real Realtime Database write (modular SDK)
  const { ref, set, push } = await import('firebase/database');

  // We'll store the manifest under /mailbuilder/themes/{userId}/{generatedId}
  const baseRef = ref(db, `mailbuilder/themes/${userId}`);
  const newRef = push(baseRef);
  await set(newRef, { ...manifest, createdAt: Date.now() });
  return { ok: true, key: newRef.key, path: `mailbuilder/themes/${userId}/${newRef.key}` };
}

