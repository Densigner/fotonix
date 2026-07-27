import React, { useState } from "react";
import { Check, ArrowRight, Users, PoundSterling, Globe, Rocket, Sparkles, Heart } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { API_URL } from "../../config/environment";
import firebase from 'firebase/compat/app';

// Short, speakable base derived from the signup email (e.g. "josh@x.com" -> "JOSH"),
// so codes read out naturally in a video ("fotonix.co.uk slash JOSH42") instead of
// a random string like "AFF813A73".
function slugFromEmail(email) {
  const local = (email.split('@')[0] || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return local.slice(0, 8) || 'AFF';
}

// Runs after signup() so the RTDB read is authenticated. Retries with a new
// random suffix if the candidate is already taken; falls back to using the
// candidate as-is if the uniqueness check itself can't run (e.g. rules deny
// the read) rather than blocking signup entirely.
async function generateUniqueAffiliateCode(realtime, email) {
  const base = slugFromEmail(email);
  for (let attempt = 0; attempt < 25; attempt++) {
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const candidate = `${base}${suffix}`;
    try {
      const snap = await realtime.ref('affiliates').orderByChild('code').equalTo(candidate).once('value');
      if (!snap.exists()) return candidate;
    } catch (e) {
      return candidate;
    }
  }
  // Extremely unlikely fallback: append a timestamp fragment to guarantee uniqueness.
  return `${base}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

export default function AffiliateSignupPage({ onSubmit }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [affiliateCode, setAffiliateCode] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password) return setError('Please provide email and password');
    setSubmitting(true);
    try {
      const res = await signup(form.email, form.password, {});
      const uid = res.user.uid;

      // Generate the code post-signup (authenticated) so we can check it against
      // existing codes in Realtime DB and avoid collisions.
      const realtime = firebase.database();
      const code = await generateUniqueAffiliateCode(realtime, form.email);

      // write affiliate record in realtime DB (canonical affiliate list)
      await realtime.ref(`affiliates/${uid}`).set({
        email: form.email,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        approved: false,
        code,
      });

      // Send custom verification email via VPS with userType 'affiliate'
      try {
        const verificationResponse = await fetch(`${API_URL}/api/auth/send-custom-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            firebaseUid: uid,
            email: form.email,
            businessName: '', // Affiliates may not have a business name
            userType: 'affiliate' // Affiliate signup flow
          }),
        });

        if (verificationResponse.ok) {
          console.log('✅ Custom verification email sent for affiliate');
        } else {
          console.warn('⚠️ Failed to send custom verification email, but signup succeeded');
        }
      } catch (evErr) {
        console.warn('Verification email failed:', evErr);
      }

      // also ensure user's profile has affiliate info (affiliateCode and affiliateApproved)
      try {
        await realtime.ref(`users/${uid}`).update({
          affiliateCode: code,
          affiliateApproved: false,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });
      } catch (uErr) {
        console.warn('Failed to write affiliate fields to users/{uid}:', uErr);
      }

  setAffiliateCode(code);
  setSuccess(true);
      setForm({ email: "", password: "" });
      if (onSubmit) onSubmit();
    } catch (err) {
      console.error('Affiliate signup error', err);
      setError(err.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Earn <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">10% Commission</span> Selling Our Products
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
          Join our affiliate program today and turn your influence into income. It’s free, simple, and designed to help you succeed.
        </p>
      </section>

      <section className="mx-auto max-w-lg px-6 py-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md">
          <h2 className="mb-4 text-center text-2xl font-bold text-gray-900">Join the Program</h2>
          <p className="mb-6 text-center text-gray-600">Create an account and you’ll be added to the affiliates list.</p>

          {success ? (
            <div className="rounded-lg bg-green-50 p-4 text-green-700 space-y-3">
              <div>Thanks for signing up! A verification email was sent — please check your inbox and click the verification link. Once verified we will review and approve your affiliate access.</div>
              {affiliateCode && (
                <div className="mt-2">
                  <div className="text-sm text-gray-700">Your affiliate code:</div>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <code className="rounded-md bg-white px-3 py-2 border border-gray-200">{affiliateCode}</code>
                    <button className="text-sm text-blue-600" onClick={() => { navigator.clipboard?.writeText(affiliateCode); alert('Copied affiliate code'); }}>Copy</button>
                  </div>
                  <div className="mt-3 text-sm text-gray-700">Your referral link will be: <span className="font-medium">{window.location.origin}/?ref={affiliateCode}</span></div>
                </div>
              )}
              <div className="mt-3">
                <button className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm" onClick={async () => {
                  try {
                    // attempt to resend verification using currentUser
                    const current = firebase.auth().currentUser;
                    if (current && typeof current.sendEmailVerification === 'function') {
                      await current.sendEmailVerification();
                      alert('Verification email resent');
                    } else alert('Unable to resend verification right now');
                  } catch (e) { console.warn('resend verification failed', e); alert('Failed to resend verification email'); }
                }}>Resend verification email</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-violet-500 focus:ring-violet-500 bg-white text-black"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-violet-500 focus:ring-violet-500 bg-white text-black"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Join the Program"}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="py-10 text-center text-sm text-gray-500">
        By signing up, you agree to our <a href="/affiliate-terms" className="text-gradient hover:underline">Affiliate Terms</a>.
      </footer>
    </div>
  );
}
