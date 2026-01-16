import { ref as dbRef, set, get, push } from "firebase/database";

export async function saveSnapshot(db, uid, payload) {
  const versions = dbRef(db, `storefrontVersions/${uid}`);
  const node = push(versions);
  const snapshot = { id: node.key, createdAt: Date.now(), data: payload };
  await set(node, snapshot);
  return snapshot;
}

export async function listSnapshots(db, uid) {
  const snap = await get(dbRef(db, `storefrontVersions/${uid}`));
  if (!snap.exists()) return [];
  const val = snap.val();
  return Object.keys(val).map((k) => val[k]);
}
