import { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, onValue, set, serverTimestamp, onDisconnect } from "firebase/database";

export function usePresence(docId, user) {
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    if (!docId || !user?.uid) return;
    const db = getDatabase();
    const meRef = dbRef(db, `presence/${docId}/${user.uid}`);
    set(meRef, { uid: user.uid, name: user.displayName || "User", at: serverTimestamp() });
    try { onDisconnect(meRef).remove?.(); } catch {}

    const roomRef = dbRef(db, `presence/${docId}`);
    return onValue(roomRef, (snap) => {
      const val = snap.val() || {};
      setPeers(Object.values(val));
    });
  }, [docId, user]);

  return peers;
}

export default usePresence;