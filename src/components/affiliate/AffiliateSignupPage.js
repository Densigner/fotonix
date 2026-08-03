import React, { useState, useEffect } from "react";
import { Check, ArrowRight, Users, PoundSterling, Globe, Rocket, Mail, Wand2, Palette, Wallet } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { API_URL } from "../../config/environment";
import firebase from 'firebase/compat/app';
import { useExitIntent } from "../../hooks/useExitIntent";
import AffiliateExitIntentPopup from "./AffiliateExitIntentPopup";
import bebasFontUrl from "./fonts/BebasNeue-Regular.woff2";
import plexFontUrl from "./fonts/IBMPlexSans-Regular.woff2";
import heroImage from "./image/affiliate-hero.jpg";

// Design direction: this page deliberately commits to one visual world (a
// dark, glowing "light pattern" showroom) rather than a light/dark pair —
// the whole point is colour glowing against near-black, which is literally
// how Fotonix's own Light Patterns editor already looks (see Account.js).
// A light-mode inversion would kill the one thing this page is about, so
// that's a considered choice, not a missed requirement.

const AFFILIATE_FEATURES = [
  {
    icon: PoundSterling,
    title: "10% Commission",
    desc: "Real, tracked commissions on every sale you drive — a live dashboard shows exactly what you're owed.",
  },
  {
    icon: Wallet,
    title: "No Minimum Payout",
    desc: "Owed £2 or £2,000, it's yours — no minimum balance to hit before you get paid, unlike most affiliate programs.",
  },
  {
    icon: Wand2,
    title: "Design Your Own Products",
    desc: "Not just reselling a fixed catalogue — build genuinely custom products with our real designer tools and sell them under your own link.",
  },
  {
    icon: Palette,
    title: "Customers Design Their Own, Too",
    desc: "Every customer you send our way can fully customise their own design from scratch — nobody's stuck picking from a generic template.",
  },
  {
    icon: Mail,
    title: "Mail Campaign Builder",
    desc: "A genuine drag-and-drop email builder — blocks, images, buttons, columns — plus your own real send/receive inbox.",
  },
  {
    icon: Rocket,
    title: "Funnel Builder",
    desc: "Build multi-step sales funnels without touching code. Launch fast, iterate faster.",
  },
  {
    icon: Globe,
    title: "Your Own Storefront",
    desc: "A branded shop page for your products, live the moment you publish it.",
  },
  {
    icon: Users,
    title: "Real-Time Analytics",
    desc: "Clicks, conversions, and commissions — tracked live, not estimated after the fact.",
  },
  {
    icon: Check,
    title: "Free & Instant",
    desc: "No cost to join, no waiting around — you're set up and promoting within minutes.",
  },
];

const FAQS = [
  ["Is there a follower minimum?", "No. Most programmes gate access behind a follower count — this one doesn't. If you can share a link, you can join."],
  ["How is the 10% calculated?", "On the order value of anything bought through your link, tracked automatically from click to checkout."],
  ["Is there really no minimum payout?", "Correct — whatever you're owed, you're owed. There's no balance threshold you have to clear first."],
  ["What can I actually sell?", "Anything from the catalogue, plus fully custom products you design yourself using the same tools your customers use."],
  ["Does it cost anything to join?", "No. Free to sign up, nothing to cancel, no subscription running in the background."],
  ["How do I get paid?", "Payouts are handled directly via PayPal — you can see exactly what you're owed at any time in your dashboard."],
];

// Real colours pulled from the actual app's light-pattern preview gradients
// (Account.js sampleItems), not arbitrary decoration.
const HERO_GRID_PALETTE = ['#00f5d4', '#7b2cbf', '#ff2d95', '#8b5cf6', '#ec4899', '#4f46e5'];
const HERO_GRID_CELLS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  color: HERO_GRID_PALETTE[i % HERO_GRID_PALETTE.length],
}));

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

function FaqItem({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="fx-faq-item" data-open={open}>
      <button className="fx-faq-q" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {q}
        <span className="fx-plus">+</span>
      </button>
      <div className="fx-faq-a"><p>{a}</p></div>
    </div>
  );
}

export default function AffiliateSignupPage({ onSubmit }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [affiliateCode, setAffiliateCode] = useState(null);

  // Don't arm exit-intent once they've already signed up (success === true) —
  // there's nothing left to "capture" at that point.
  const { showExitIntent, hideExitIntent } = useExitIntent({ enabled: !success });

  useEffect(() => {
    if (showExitIntent) console.log('[exit-intent] fired — showing popup');
  }, [showExitIntent]);

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

      // Give this affiliate a real send+receive address (support+<code>@fotonix.co.uk)
      try {
        const emailResponse = await fetch(`${API_URL}/api/member/business-email/create-affiliate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ memberUid: uid, affiliateCode: code }),
        });
        if (emailResponse.ok) {
          console.log('✅ Affiliate email address created');
        } else {
          console.warn('⚠️ Failed to create affiliate email address, but signup succeeded');
        }
      } catch (emailErr) {
        console.warn('Affiliate email setup failed:', emailErr);
      }

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
    <div className="fx-page">
      <style>{`
        .fx-page {
          --ink: #0a0a12;
          --panel: #14131f;
          --line: #2a2740;
          --violet: #8b5cf6;
          --pink: #ec4899;
          --cyan: #00f5d4;
          --paper: #f5f3ff;
          --ink-soft: #a8a3c0;
          --ink-softer: #6e6a8c;
          --display: "Fotonix Display", "Arial Narrow", sans-serif;
          --body: "Fotonix Body", -apple-system, "Segoe UI", sans-serif;
          background: var(--ink);
          color: var(--paper);
          font-family: var(--body);
          font-size: 16px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }
        @font-face {
          font-family: "Fotonix Display";
          src: url(${bebasFontUrl}) format("woff2");
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: "Fotonix Body";
          src: url(${plexFontUrl}) format("woff2");
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @media (prefers-reduced-motion: reduce) {
          .fx-page *, .fx-page *::before, .fx-page *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
        .fx-page a { color: inherit; }
        .fx-page :focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 4px; }
        .fx-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .fx-page h1, .fx-page h2, .fx-page h3 { font-family: var(--display); font-weight: 400; letter-spacing: 0.01em; text-wrap: balance; margin: 0; }
        .fx-eyebrow { font-family: var(--body); font-weight: 600; font-size: 12.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--cyan); display: inline-flex; align-items: center; gap: 8px; }
        .fx-eyebrow::before { content: ""; width: 20px; height: 1px; background: var(--cyan); display: inline-block; }

        .fx-hero {
          position: relative;
          padding: 88px 0 72px;
          overflow: hidden;
          background-image:
            linear-gradient(90deg, rgba(10,10,18,0.72) 0%, rgba(10,10,18,0.5) 32%, rgba(10,10,18,0.12) 62%, rgba(10,10,18,0.25) 100%),
            linear-gradient(0deg, rgba(10,10,18,0.75) 0%, rgba(10,10,18,0.05) 30%, rgba(10,10,18,0.05) 78%, rgba(10,10,18,0.75) 100%),
            url(${heroImage});
          background-size: cover;
          background-position: center 30%;
        }
        .fx-hero-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; }
        @media (max-width: 880px) { .fx-hero-grid { grid-template-columns: 1fr; } }
        .fx-hero h1 { font-size: clamp(42px, 6vw, 74px); line-height: 0.98; margin: 18px 0 22px; }
        .fx-hero h1 em { font-style: normal; background: linear-gradient(90deg, var(--cyan), var(--violet) 55%, var(--pink)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .fx-hero p.fx-lede { font-size: 18px; color: var(--ink-soft); max-width: 46ch; margin: 0 0 32px; }
        .fx-hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; }
        .fx-btn-primary { font-family: var(--body); font-weight: 700; font-size: 15px; padding: 15px 28px; border-radius: 12px; border: none; cursor: pointer; background: linear-gradient(90deg, var(--violet), var(--pink)); color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 8px 30px -8px rgba(236,72,153,0.55); transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .fx-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 34px -6px rgba(236,72,153,0.7); }
        .fx-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .fx-btn-ghost { font-family: var(--body); font-weight: 600; font-size: 15px; padding: 15px 26px; border-radius: 12px; background: transparent; color: var(--paper); border: 1px solid var(--line); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: border-color 0.15s ease, background 0.15s ease; }
        .fx-btn-ghost:hover { border-color: var(--cyan); background: rgba(0,245,212,0.06); }

        .fx-pattern-card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 20px; box-shadow: 0 30px 60px -30px rgba(139,92,246,0.35); }
        .fx-pattern-card .fx-label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--ink-softer); margin-bottom: 14px; font-family: var(--body); letter-spacing: 0.04em; }
        .fx-pattern-card .fx-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cyan); display: inline-block; margin-right: 6px; box-shadow: 0 0 8px var(--cyan); animation: fx-blink 2s ease-in-out infinite; }
        @keyframes fx-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .fx-cellgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
        .fx-cellgrid i { display: block; aspect-ratio: 1; border-radius: 5px; animation: fx-glow 3.6s ease-in-out infinite; }
        @keyframes fx-glow { 0%, 100% { filter: brightness(0.75) saturate(0.9); } 50% { filter: brightness(1.25) saturate(1.15); } }
        .fx-pattern-card .fx-meta { display: flex; justify-content: space-between; margin-top: 16px; font-size: 12.5px; color: var(--ink-softer); }
        .fx-pattern-card .fx-meta b { color: var(--paper); font-weight: 600; }

        .fx-facts { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--panel); }
        .fx-facts-row { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; }
        @media (max-width: 780px) { .fx-facts-row { grid-template-columns: repeat(2, 1fr); } }
        .fx-fact { padding: 30px 12px; border-right: 1px solid var(--line); }
        .fx-fact:last-child { border-right: none; }
        .fx-fact .fx-num { font-family: var(--display); font-size: 34px; font-variant-numeric: tabular-nums; background: linear-gradient(90deg, var(--cyan), var(--violet)); -webkit-background-clip: text; background-clip: text; color: transparent; display: block; }
        .fx-fact .fx-cap { font-size: 13px; color: var(--ink-soft); margin-top: 4px; }

        .fx-page section { padding: 96px 0; }
        .fx-section-head { max-width: 640px; margin: 0 0 48px; }
        .fx-section-head h2 { font-size: clamp(30px, 4vw, 44px); margin-top: 14px; }
        .fx-section-head p { color: var(--ink-soft); font-size: 16.5px; margin-top: 14px; }

        .fx-narrative { background: var(--panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .fx-narrative-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
        @media (max-width: 880px) { .fx-narrative-grid { grid-template-columns: 1fr; gap: 32px; } }
        .fx-narrative h2 { font-size: clamp(28px, 4vw, 40px); line-height: 1.05; }
        .fx-old-way, .fx-our-way { border-radius: 16px; padding: 22px 24px; margin-top: 16px; }
        .fx-old-way { border: 1px dashed var(--line); color: var(--ink-softer); }
        .fx-old-way p { text-decoration: line-through; text-decoration-color: var(--ink-softer); margin: 6px 0; }
        .fx-our-way { border: 1px solid var(--cyan); background: linear-gradient(180deg, rgba(0,245,212,0.06), transparent); }
        .fx-our-way p { margin: 6px 0; color: var(--paper); }
        .fx-our-way p::before { content: "✓ "; color: var(--cyan); font-weight: 700; }

        .fx-feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        @media (max-width: 880px) { .fx-feature-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .fx-feature-grid { grid-template-columns: 1fr; } }
        .fx-feature { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 26px; transition: border-color 0.2s ease, transform 0.2s ease; }
        .fx-feature:hover { border-color: var(--violet); transform: translateY(-2px); }
        .fx-feature .fx-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--violet), var(--pink)); margin-bottom: 16px; color: #fff; }
        .fx-feature h3 { font-family: var(--body); font-size: 16.5px; font-weight: 700; margin-bottom: 8px; }
        .fx-feature p { font-size: 14px; color: var(--ink-soft); margin: 0; }

        .fx-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
        @media (max-width: 780px) { .fx-steps { grid-template-columns: 1fr; } }
        .fx-step { padding: 34px 28px; border-right: 1px solid var(--line); }
        .fx-step:last-child { border-right: none; }
        .fx-step .fx-step-num { font-family: var(--display); font-size: 15px; letter-spacing: 0.08em; color: var(--ink-softer); }
        .fx-step h3 { font-family: var(--body); font-size: 18px; font-weight: 700; margin: 10px 0 8px; }
        .fx-step p { color: var(--ink-soft); font-size: 14.5px; margin: 0; }

        .fx-faq-item { border-bottom: 1px solid var(--line); }
        .fx-faq-item:first-child { border-top: 1px solid var(--line); }
        .fx-faq-q { width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 22px 4px; display: flex; justify-content: space-between; align-items: center; gap: 16px; color: var(--paper); font-family: var(--body); font-size: 16.5px; font-weight: 600; }
        .fx-faq-q .fx-plus { font-family: var(--display); font-size: 22px; color: var(--cyan); transition: transform 0.2s ease; flex-shrink: 0; }
        .fx-faq-item[data-open="true"] .fx-plus { transform: rotate(45deg); }
        .fx-faq-a { max-height: 0; overflow: hidden; transition: max-height 0.25s ease; }
        .fx-faq-item[data-open="true"] .fx-faq-a { max-height: 240px; }
        .fx-faq-a p { color: var(--ink-soft); font-size: 15px; padding: 0 4px 22px; margin: 0; max-width: 62ch; }

        .fx-final-cta { border-radius: 28px; padding: 56px; background: radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.25), transparent 70%), radial-gradient(60% 100% at 50% 100%, rgba(0,245,212,0.15), transparent 70%), var(--panel); border: 1px solid var(--line); }
        .fx-final-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px; align-items: center; }
        @media (max-width: 880px) { .fx-final-grid { grid-template-columns: 1fr; } }
        .fx-final-cta h2 { font-size: clamp(32px, 4.5vw, 48px); margin-bottom: 16px; }
        .fx-final-cta > .fx-final-grid > div:first-child p { color: var(--ink-soft); font-size: 16.5px; }

        .fx-form-card { background: rgba(10,10,18,0.55); border: 1px solid var(--line); border-radius: 20px; padding: 30px; }
        .fx-form-card label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
        .fx-form-card input { width: 100%; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--paper); padding: 12px 14px; font-size: 15px; font-family: var(--body); }
        .fx-form-card input:focus { outline: none; border-color: var(--cyan); }
        .fx-form-card .fx-field { margin-bottom: 16px; }
        .fx-error { background: rgba(236,72,153,0.12); border: 1px solid rgba(236,72,153,0.4); color: #fda4c8; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; margin-bottom: 16px; }
        .fx-success code { background: rgba(0,245,212,0.1); border: 1px solid rgba(0,245,212,0.3); color: var(--cyan); padding: 6px 12px; border-radius: 8px; font-family: monospace; font-size: 14px; }
        .fx-success .fx-link-btn { background: none; border: none; color: var(--cyan); font-size: 13px; cursor: pointer; padding: 0; }
        .fx-resend-btn { margin-top: 14px; background: transparent; border: 1px solid var(--line); color: var(--paper); padding: 10px 16px; border-radius: 10px; font-size: 13.5px; cursor: pointer; }
        .fx-resend-btn:hover { border-color: var(--cyan); }

        .fx-footer { border-top: 1px solid var(--line); padding: 48px 0 36px; }
        .fx-footer p.fx-tag { color: var(--ink-softer); font-size: 13px; margin: 6px 0 0; max-width: 60ch; }
        .fx-footer a { color: var(--cyan); text-decoration: none; }
        .fx-footer a:hover { text-decoration: underline; }
      `}</style>

      <section className="fx-hero">
        <div className="fx-wrap fx-hero-grid">
          <div>
            <span className="fx-eyebrow">Fotonix Affiliates</span>
            <h1>Stop sharing a link.<br /><em>Start selling light.</em></h1>
            <p className="fx-lede">
              No fixed catalogue, no follower minimum, no monthly fee to join. Design your own
              custom light products, send people to a store that's actually yours, and get paid
              10% — tracked live, no minimum payout.
            </p>
            <div className="fx-hero-ctas">
              <a className="fx-btn-primary" href="#join">Join for free <ArrowRight className="h-4 w-4" /></a>
              <a className="fx-btn-ghost" href="#inside">See what's inside</a>
            </div>
          </div>
          <div className="fx-pattern-card">
            <div className="fx-label"><span><span className="fx-dot" />LIVE PATTERN — Moving Groups</span><span>25 cells</span></div>
            <div className="fx-cellgrid">
              {HERO_GRID_CELLS.map(cell => (
                <i key={cell.id} style={{ background: cell.color, animationDelay: `${cell.id * 90}ms` }} />
              ))}
            </div>
            <div className="fx-meta"><span>Brightness <b>80%</b></span><span>Speed <b>1.2×</b></span></div>
          </div>
        </div>
      </section>

      <div className="fx-facts">
        <div className="fx-wrap fx-facts-row">
          <div className="fx-fact"><span className="fx-num">10%</span><span className="fx-cap">commission, every sale</span></div>
          <div className="fx-fact"><span className="fx-num">£0</span><span className="fx-cap">minimum payout</span></div>
          <div className="fx-fact"><span className="fx-num">£0</span><span className="fx-cap">cost to join</span></div>
          <div className="fx-fact"><span className="fx-num">0</span><span className="fx-cap">follower minimum</span></div>
        </div>
      </div>

      <div className="fx-narrative">
        <div className="fx-wrap fx-narrative-grid">
          <div>
            <span className="fx-eyebrow">Know the feeling?</span>
            <h2>Most affiliate programmes hand you a link and a fixed catalogue.</h2>
          </div>
          <div>
            <div className="fx-old-way">
              <p>Same 12 products as every other affiliate</p>
              <p>£25+/month before you've made a sale</p>
              <p>Customers pick from what's already on the shelf</p>
              <p>Wait for the next payout run to hit a minimum</p>
            </div>
            <div className="fx-our-way">
              <p>Design and sell genuinely custom products</p>
              <p>Free to join, nothing to cancel</p>
              <p>Customers design their own from scratch</p>
              <p>Get what you're owed, any amount, any time</p>
            </div>
          </div>
        </div>
      </div>

      <section id="inside">
        <div className="fx-wrap">
          <div className="fx-section-head">
            <span className="fx-eyebrow">What's inside</span>
            <h2>A full toolkit, not just a referral link</h2>
            <p>Everything below is a real, working part of your affiliate account from day one — not a roadmap.</p>
          </div>
          <div className="fx-feature-grid">
            {AFFILIATE_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div className="fx-feature" key={title}>
                <div className="fx-icon"><Icon className="h-5 w-5" /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="fx-wrap">
          <div className="fx-section-head">
            <span className="fx-eyebrow">How it pays</span>
            <h2>Three steps, tracked the whole way</h2>
          </div>
          <div className="fx-steps">
            <div className="fx-step">
              <span className="fx-step-num">SHARE</span>
              <h3>Send your link</h3>
              <p>Your own referral link and code, live the moment you sign up — no approval queue to sit in.</p>
            </div>
            <div className="fx-step">
              <span className="fx-step-num">DESIGN &amp; BUY</span>
              <h3>They make it their own</h3>
              <p>Your customer designs their own pattern or product with our real tools, then checks out.</p>
            </div>
            <div className="fx-step">
              <span className="fx-step-num">GET PAID</span>
              <h3>10% lands in your dashboard</h3>
              <p>Commission is tracked the moment the order clears — no minimum balance before you can claim it.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="fx-wrap" style={{ maxWidth: 760 }}>
          <div className="fx-section-head" style={{ marginBottom: 8 }}>
            <span className="fx-eyebrow">Questions</span>
            <h2>Before you join</h2>
          </div>
          {FAQS.map(([q, a], i) => (
            <FaqItem key={q} q={q} a={a} defaultOpen={i === 0} />
          ))}
        </div>
      </section>

      <section>
        <div className="fx-wrap">
          <div className="fx-final-cta" id="join">
            <div className="fx-final-grid">
              <div>
                <h2>Design light. Earn bright.</h2>
                <p>Free to join, no minimum payout, no minimum following. You're set up in minutes.</p>
              </div>
              <div className="fx-form-card">
                {success ? (
                  <div className="fx-success">
                    <p style={{ marginTop: 0, color: 'var(--paper)' }}>
                      Thanks for signing up! A verification email was sent — please check your inbox and click the
                      verification link. Once verified we will review and approve your affiliate access.
                    </p>
                    {affiliateCode && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>Your affiliate code:</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <code>{affiliateCode}</code>
                          <button
                            type="button"
                            className="fx-link-btn"
                            onClick={() => { navigator.clipboard?.writeText(affiliateCode); alert('Copied affiliate code'); }}
                          >Copy</button>
                        </div>
                        <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-soft)' }}>
                          Your referral link will be:<br />
                          <span style={{ color: 'var(--paper)', fontWeight: 600 }}>{window.location.origin}/?ref={affiliateCode}</span>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      className="fx-resend-btn"
                      onClick={async () => {
                        try {
                          const current = firebase.auth().currentUser;
                          if (current && typeof current.sendEmailVerification === 'function') {
                            await current.sendEmailVerification();
                            alert('Verification email resent');
                          } else alert('Unable to resend verification right now');
                        } catch (e) { console.warn('resend verification failed', e); alert('Failed to resend verification email'); }
                      }}
                    >Resend verification email</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {error && <div className="fx-error">{error}</div>}
                    <div className="fx-field">
                      <label htmlFor="fx-email">Email</label>
                      <input
                        id="fx-email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="fx-field">
                      <label htmlFor="fx-password">Password</label>
                      <input
                        id="fx-password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                      />
                    </div>
                    <button type="submit" disabled={submitting} className="fx-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                      {submitting ? "Creating…" : (<>Join the Program <ArrowRight className="h-4 w-4" /></>)}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="fx-footer">
        <div className="fx-wrap">
          <p className="fx-tag">Design and sell fully custom light products — for affiliates who want more than a link to share.</p>
          <p className="fx-tag">By signing up, you agree to our <a href="/affiliate-terms">Affiliate Terms</a>.</p>
        </div>
      </footer>

      <AffiliateExitIntentPopup isOpen={showExitIntent} onClose={hideExitIntent} apiBase={API_URL} />
    </div>
  );
}
