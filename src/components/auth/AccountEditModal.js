import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, KeyRound, User, AlertTriangle, CheckCircle2, Shield } from "lucide-react";

/**
 * AccountSettingsModal — pink→violet styled account panel
 *
 * Firebase Auth expected to be initialized elsewhere in your app.
 * The modal supports:
 *  - Update display name (user profile)
 *  - Change email (reauth required)
 *  - Change password (reauth required)
 *  - Optional username/handle save via callback (for RTDB/Firestore)
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - getCurrentUser: () => { uid: string; email: string | null; displayName: string | null } | null
 *  - onSaveUsername?: (username: string) => Promise<void> | void   // if you maintain a separate username/handle
 *  - onAfterProfileUpdate?: () => void
 */

export default function AccountSettingsModal({
  isOpen,
  onClose,
  getCurrentUser,
  onSaveUsername,
  onAfterProfileUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  getCurrentUser: () => { uid: string; email: string | null; displayName: string | null } | null;
  onSaveUsername?: (username: string) => Promise<void> | void;
  onAfterProfileUpdate?: () => void;
}) {
  const user = getCurrentUser();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username, setUsername] = useState(""); // optional, saved via onSaveUsername
  const [email, setEmail] = useState(user?.email || "");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState(""); // for reauth

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const u = getCurrentUser();
    setDisplayName(u?.displayName || "");
    setEmail(u?.email || "");
  }, [isOpen]);

  const ok = (msg: string) => setToast({ kind: "ok", msg });
  const err = (msg: string) => setToast({ kind: "err", msg });

  // Helpers (lazy import to avoid bundling Firebase in this file)
  async function withAuth<T>(fn: (m: typeof import("firebase/auth")) => Promise<T>): Promise<T> {
    const m = await import("firebase/auth");
    return fn(m);
  }

  function sanitizeUsername(v: string) {
    return v.toLowerCase().trim().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  }

  async function handleUpdateProfile() {
    if (!user) return err("Not signed in");
    try {
      setBusy(true);
      await withAuth(async ({ getAuth, updateProfile }) => {
        const auth = getAuth();
        if (!auth.currentUser) throw new Error("Not signed in");
        await updateProfile(auth.currentUser, { displayName: displayName.trim() || null });
      });
      if (username && onSaveUsername) await onSaveUsername(sanitizeUsername(username));
      onAfterProfileUpdate?.();
      ok("Profile updated");
    } catch (e: any) {
      err(e.message || "Failed to update profile");
    } finally { setBusy(false); }
  }

  async function reauthIfNeeded(currentPasswordInput: string) {
    return withAuth(async ({ getAuth, EmailAuthProvider, reauthenticateWithCredential }) => {
      const auth = getAuth();
      const u = auth.currentUser;
      if (!u || !u.email) throw new Error("Not signed in");
      const cred = EmailAuthProvider.credential(u.email, currentPasswordInput);
      await reauthenticateWithCredential(u, cred);
    });
  }

  async function handleChangeEmail() {
    if (!user) return err("Not signed in");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Enter a valid email");
    if (!currentPassword) return err("Enter your current password to verify");
    try {
      setBusy(true);
      await reauthIfNeeded(currentPassword);
      await withAuth(async ({ getAuth, updateEmail }) => {
        const auth = getAuth();
        if (!auth.currentUser) throw new Error("Not signed in");
        await updateEmail(auth.currentUser, email.trim());
      });
      ok("Email changed");
      setCurrentPassword("");
    } catch (e: any) {
      // Common Firebase messages are technical; show friendly fallback
      err(e.message || "Couldn't change email");
    } finally { setBusy(false); }
  }

  async function handleChangePassword() {
    if (!user) return err("Not signed in");
    if (!newPassword || newPassword.length < 8) return err("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return err("Passwords do not match");
    if (!currentPassword) return err("Enter your current password to verify");
    try {
      setBusy(true);
      await reauthIfNeeded(currentPassword);
      await withAuth(async ({ getAuth, updatePassword }) => {
        const auth = getAuth();
        if (!auth.currentUser) throw new Error("Not signed in");
        await updatePassword(auth.currentUser, newPassword);
      });
      ok("Password changed");
      setNewPassword(""); setConfirmPassword(""); setCurrentPassword("");
    } catch (e: any) {
      err(e.message || "Couldn't change password");
    } finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div role="dialog" aria-modal="true" className="relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Account settings</h2>
                </div>
                <button aria-label="Close" onClick={onClose} className="rounded-full p-1.5 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"><X className="h-5 w-5" /></button>
              </div>
              <p className="mt-1 text-xs/relaxed text-white/90">Manage your profile, email and password.
              </p>
            </div>

            {/* Body */}
            <div className="bg-white p-4 dark:bg-zinc-900">
              {/* Profile */}
              <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Profile</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs text-zinc-600">Display name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0,60))} className="md:col-span-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="Your name" />

                  <label className="text-xs text-zinc-600">Username (optional)</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="md:col-span-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="your-handle" />
                </div>
                <div className="mt-3">
                  <button onClick={handleUpdateProfile} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <User className="h-4 w-4" /> Save Profile
                  </button>
                </div>
              </section>

              {/* Email */}
              <section className="mt-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Email</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs text-zinc-600">New email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="you@example.com" />

                  <label className="text-xs text-zinc-600">Current password (for verification)</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="••••••••" />
                </div>
                <div className="mt-3">
                  <button onClick={handleChangeEmail} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <Mail className="h-4 w-4" /> Change Email
                  </button>
                </div>
              </section>

              {/* Password */}
              <section className="mt-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Password</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs text-zinc-600">New password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="At least 8 characters" />

                  <label className="text-xs text-zinc-600">Confirm new password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="Repeat password" />

                  <label className="text-xs text-zinc-600">Current password (for verification)</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="••••••••" />
                </div>
                <div className="mt-3">
                  <button onClick={handleChangePassword} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <KeyRound className="h-4 w-4" /> Change Password
                  </button>
                </div>
              </section>
            </div>
          </motion.div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`fixed bottom-6 left-1/2 z-[130] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border p-4 text-sm shadow-xl ${toast.kind === "ok" ? "border-emerald-200 bg-white text-zinc-800 dark:border-emerald-900/30 dark:bg-zinc-900 dark:text-zinc-100" : "border-red-200 bg-white text-zinc-800 dark:border-red-900/30 dark:bg-zinc-900 dark:text-zinc-100"}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${toast.kind === "ok" ? "bg-emerald-500" : "bg-red-500"} text-white`}>{toast.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div>
                  <div className="flex-1"><p className="font-medium">{toast.kind === "ok" ? "Success" : "Heads up"}</p><p className="mt-0.5 text-xs opacity-80">{toast.msg}</p></div>
                  <button onClick={() => setToast(null)} className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800" aria-label="Dismiss"><X className="h-4 w-4" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
