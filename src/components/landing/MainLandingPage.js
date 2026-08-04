import React, { useState, useMemo } from 'react';
import products from '../../data/productsData';
import bebasFontUrl from '../affiliate/fonts/BebasNeue-Regular.woff2';
import plexFontUrl from '../affiliate/fonts/IBMPlexSans-Regular.woff2';
import heroImage from '../affiliate/image/affiliate-hero.jpg';
import edgelitBanner from './image/edgelit-banner.jpg';
import cutmirrorBanner from './image/cutmirror-banner.jpg';
import luminaMainPhoto from './image/lumina-main.jpg';
import luminaBgVideo from './image/lumina-bg.mp4';
import luminaBgPoster from './image/lumina-bg-poster.jpg';

const HERO_GRID_PALETTE = ['#00f5d4', '#7b2cbf', '#ff2d95', '#8b5cf6', '#ec4899', '#4f46e5'];

const LUMINA_SIZES = [
  { label: '15 × 20 cm', price: '£29.99' },
  { label: '20 × 30 cm', price: '£44.99' },
  { label: '30 × 50 cm', price: '£69.99' },
];

const DESK_ACRYLIC_SIZES = [
  { label: 'Small · ~6 × 10 cm', price: '£24.99' },
  { label: 'Medium · ~12 × 18 cm', price: '£34.99' },
  { label: 'Large · ~20 × 28 cm', price: '£49.99' },
  { label: 'XL · 30 × 40 cm', price: '£69.99' },
];

const FAQS = [
  ['Can I choose any shape for my mirror?', "Yes — outline whatever shape you want and we'll cut the mirror to match, with professional edge polishing included."],
  ['Does the mirror fog up in the bathroom?', 'No — the LED Lumina Mirror uses anti-fog technology, so it stays clear even in a steamy bathroom.'],
  ['Can I use my own photo or design?', 'Yes — the Stencil Generator turns any photo you upload into a printable stencil, and the Acrylic Designer lets you build your own logo, name, or decorative piece from scratch.'],
  ['How much does it cost to get started?', 'From £9.99 for the Stencil Generator. Full LED mirrors and acrylic pieces start at £29.99.'],
  ['Is everything made to order?', 'Yes — nothing is pulled off a shelf. Every piece is cut, printed, or lit to your exact design after you order it.'],
];

// Mirrors Products.js's handleProductSelect link-resolution exactly, so this page
// navigates identically to the real product grid.
function computeProductHref(product) {
  const link = product.link;
  if (!link) return null;
  if (link.startsWith('http') || link.startsWith('/')) return link;
  if (link.startsWith('#')) return link;
  if (link.includes('/')) return `/${link}`;
  return `/#${link}`;
}

function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="mlp-faq-item" data-open={isOpen}>
      <button className="mlp-faq-q" aria-expanded={isOpen} onClick={onToggle}>
        {q}
        <span className="mlp-plus">+</span>
      </button>
      <div className="mlp-faq-a"><p>{a}</p></div>
    </div>
  );
}

export default function MainLandingPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [luminaSize, setLuminaSize] = useState(0);
  const [deskAcrylicSize, setDeskAcrylicSize] = useState(0);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ name: '', email: '', phone: '', description: '' });
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  const heroCells = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({
      color: HERO_GRID_PALETTE[Math.floor(Math.random() * HERO_GRID_PALETTE.length)],
      delay: i * 90,
    })),
    []
  );

  const lumina = products[0];
  const wallAcrylic = products[1];
  const customMirror = products[2];
  const stencil = products[3];
  const deskAcrylic = products[4];

  const goToProduct = (product) => {
    if (product.isCustomQuote) {
      setShowQuoteModal(true);
      return;
    }
    const href = computeProductHref(product);
    if (href) {
      window.location.href = href;
      setTimeout(() => window.scrollTo(0, 0), 50);
    }
  };

  const handleQuoteSubmit = (e) => {
    e.preventDefault();
    console.log('Quote request:', quoteForm);
    setQuoteSubmitted(true);
  };

  const closeQuoteModal = () => {
    setShowQuoteModal(false);
    setQuoteSubmitted(false);
    setQuoteForm({ name: '', email: '', phone: '', description: '' });
  };

  return (
    <div className="mlp-page">
      <style>{`
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

        .mlp-page {
          --ink: #0a0a12; --panel: #14131f; --line: #2a2740;
          --violet: #8b5cf6; --pink: #ec4899; --cyan: #00f5d4;
          --paper: #f5f3ff; --ink-soft: #a8a3c0; --ink-softer: #6e6a8c;
          --display: "Fotonix Display", "Arial Narrow", sans-serif;
          --body: "Fotonix Body", -apple-system, "Segoe UI", sans-serif;
          background: var(--ink); color: var(--paper); font-family: var(--body);
          font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; overflow-x: hidden;
        }
        .mlp-page * { box-sizing: border-box; }
        .mlp-page a { color: inherit; }
        .mlp-page :focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 4px; }
        .mlp-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .mlp-page h1, .mlp-page h2, .mlp-page h3 { font-family: var(--display); font-weight: 400; letter-spacing: 0.01em; text-wrap: balance; margin: 0; }
        .mlp-eyebrow { font-family: var(--body); font-weight: 600; font-size: 12.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--cyan); display: inline-flex; align-items: center; gap: 8px; }
        .mlp-eyebrow::before { content: ""; width: 20px; height: 1px; background: var(--cyan); display: inline-block; }

        .mlp-hero { position: relative; padding: 88px 0 72px; overflow: hidden;
          background-image:
            linear-gradient(90deg, rgba(10,10,18,0.72) 0%, rgba(10,10,18,0.5) 32%, rgba(10,10,18,0.12) 62%, rgba(10,10,18,0.25) 100%),
            linear-gradient(0deg, rgba(10,10,18,0.75) 0%, rgba(10,10,18,0.05) 30%, rgba(10,10,18,0.05) 78%, rgba(10,10,18,0.75) 100%),
            url(${heroImage});
          background-size: cover; background-position: center 30%;
        }
        .mlp-hero-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; }
        @media (max-width: 880px) { .mlp-hero-grid { grid-template-columns: 1fr; } }
        .mlp-hero h1 { font-size: clamp(42px, 6vw, 72px); line-height: 0.98; margin: 18px 0 22px; }
        .mlp-hero h1 em { font-style: normal; background: linear-gradient(90deg, var(--cyan), var(--violet) 55%, var(--pink)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .mlp-hero p.mlp-lede { font-size: 18px; color: var(--ink-soft); max-width: 46ch; margin: 0 0 32px; }
        .mlp-hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; }
        .mlp-btn-primary { font-family: var(--body); font-weight: 700; font-size: 15px; padding: 15px 28px; border-radius: 12px; border: none; cursor: pointer; background: linear-gradient(90deg, var(--violet), var(--pink)); color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 8px 30px -8px rgba(236,72,153,0.55); transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mlp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 34px -6px rgba(236,72,153,0.7); }
        .mlp-btn-ghost { font-family: var(--body); font-weight: 600; font-size: 15px; padding: 15px 26px; border-radius: 12px; background: transparent; color: var(--paper); border: 1px solid var(--line); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: border-color 0.15s ease, background 0.15s ease; }
        .mlp-btn-ghost:hover { border-color: var(--cyan); background: rgba(0,245,212,0.06); }

        .mlp-trust-row { display: flex; align-items: center; gap: 14px; margin-top: 24px; flex-wrap: wrap; }
        .mlp-trust-badge { display: inline-flex; align-items: center; flex-shrink: 0; }
        .mlp-trust-badge svg { height: 30px; width: auto; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35)); transition: transform 0.2s ease; }
        .mlp-trust-badge:hover svg { transform: translateY(-1px) scale(1.02); }
        .mlp-trust-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); text-decoration: none; color: var(--paper); font-size: 13.5px; transition: border-color 0.15s ease; }
        .mlp-trust-chip:hover { border-color: #FFD200; }
        .mlp-trust-chip b { font-weight: 700; }
        .mlp-trust-star { width: 15px; height: 15px; flex-shrink: 0; }

        .mlp-pattern-card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 20px; box-shadow: 0 30px 60px -30px rgba(139,92,246,0.35); }
        .mlp-pattern-card .mlp-label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--ink-softer); margin-bottom: 14px; font-family: var(--body); letter-spacing: 0.04em; }
        .mlp-pattern-card .mlp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cyan); display: inline-block; margin-right: 6px; box-shadow: 0 0 8px var(--cyan); animation: mlp-blink 2s ease-in-out infinite; }
        @keyframes mlp-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .mlp-cellgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
        .mlp-cellgrid i { display: block; aspect-ratio: 1; border-radius: 5px; animation: mlp-glow 3.6s ease-in-out infinite; }
        @keyframes mlp-glow { 0%, 100% { filter: brightness(0.75) saturate(0.9); } 50% { filter: brightness(1.25) saturate(1.15); } }
        .mlp-pattern-card .mlp-meta { display: flex; justify-content: space-between; margin-top: 16px; font-size: 12.5px; color: var(--ink-softer); }
        .mlp-pattern-card .mlp-meta b { color: var(--paper); font-weight: 600; }
        .mlp-pattern-card .mlp-caption { margin: 14px 0 0; padding-top: 14px; border-top: 1px solid var(--line); font-size: 13px; line-height: 1.5; color: var(--ink-soft); }

        .mlp-facts { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--panel); }
        .mlp-facts-row { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; }
        @media (max-width: 780px) { .mlp-facts-row { grid-template-columns: repeat(2, 1fr); } }
        .mlp-fact { padding: 30px 12px; border-right: 1px solid var(--line); }
        .mlp-fact:last-child { border-right: none; }
        .mlp-fact .mlp-num { font-family: var(--display); font-size: 30px; font-variant-numeric: tabular-nums; background: linear-gradient(90deg, var(--cyan), var(--violet)); -webkit-background-clip: text; background-clip: text; color: transparent; display: block; }
        .mlp-fact .mlp-cap { font-size: 13px; color: var(--ink-soft); margin-top: 4px; }

        .mlp-page section { padding: 96px 0; }
        .mlp-section-head { max-width: 640px; margin: 0 0 16px; }
        .mlp-section-head h2 { font-size: clamp(30px, 4vw, 44px); margin-top: 14px; }
        .mlp-section-head p { color: var(--ink-soft); font-size: 16.5px; margin-top: 14px; }

        .mlp-quicklinks { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
        .mlp-quicklink { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); font-weight: 600; font-size: 14px; text-decoration: none; color: var(--paper); transition: border-color 0.15s ease, transform 0.15s ease; }
        .mlp-quicklink:hover { border-color: var(--cyan); transform: translateY(-1px); }
        .mlp-qdot { width: 6px; height: 6px; border-radius: 50%; }

        .mlp-stencil-teaser { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-top: 22px; padding: 18px 24px; border: 1px dashed var(--line); border-radius: 14px; background: rgba(255,255,255,0.02); }
        .mlp-stencil-teaser p { margin: 0; font-size: 14px; color: var(--ink-soft); }
        .mlp-stencil-teaser p b { color: var(--paper); }
        .mlp-stencil-teaser a { flex-shrink: 0; font-size: 13.5px; font-weight: 700; color: var(--cyan); text-decoration: none; white-space: nowrap; }
        .mlp-stencil-teaser a:hover { text-decoration: underline; }

        .mlp-banner-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; margin-bottom: 16px; }
        .mlp-banner-badge.cyan { background: rgba(0,245,212,0.12); color: var(--cyan); border: 1px solid rgba(0,245,212,0.35); }
        .mlp-banner-badge.violet { background: rgba(139,92,246,0.14); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.4); }

        .mlp-lumina-banner, .mlp-acrylic-banner, .mlp-mirror-banner { position: relative; min-height: 480px; display: flex; align-items: center; overflow: hidden; }
        .mlp-lumina-banner, .mlp-mirror-banner { justify-content: flex-end; }

        .mlp-lumina-media { position: absolute; inset: 0; overflow: hidden; background: #05050a; }
        .mlp-lumina-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 38%; }
        .mlp-lumina-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(270deg, rgba(10,10,18,0.9) 0%, rgba(10,10,18,0.62) 40%, rgba(10,10,18,0.18) 72%, rgba(10,10,18,0.4) 100%),
            linear-gradient(0deg, rgba(10,10,18,0.55) 0%, rgba(10,10,18,0.05) 25%, rgba(10,10,18,0.05) 75%, rgba(10,10,18,0.55) 100%);
        }

        .mlp-acrylic-media {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(90deg, rgba(10,10,18,0.9) 0%, rgba(10,10,18,0.62) 40%, rgba(10,10,18,0.18) 72%, rgba(10,10,18,0.4) 100%),
            linear-gradient(0deg, rgba(10,10,18,0.55) 0%, rgba(10,10,18,0.05) 25%, rgba(10,10,18,0.05) 75%, rgba(10,10,18,0.55) 100%),
            url(${edgelitBanner});
          background-size: cover; background-position: center 28%;
        }
        .mlp-mirror-media {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(270deg, rgba(10,10,18,0.9) 0%, rgba(10,10,18,0.62) 40%, rgba(10,10,18,0.18) 72%, rgba(10,10,18,0.4) 100%),
            linear-gradient(0deg, rgba(10,10,18,0.55) 0%, rgba(10,10,18,0.05) 25%, rgba(10,10,18,0.05) 75%, rgba(10,10,18,0.55) 100%),
            url(${cutmirrorBanner});
          background-size: cover; background-position: center 40%;
        }

        .mlp-banner-card {
          position: relative; z-index: 1; max-width: 460px; margin: 0 24px;
          background: rgba(20,19,31,0.86); backdrop-filter: blur(10px);
          border: 1px solid var(--line); border-radius: 20px;
          padding: 32px 36px; box-shadow: 0 30px 60px -30px rgba(0,0,0,0.7);
        }
        .mlp-plain-card {
          max-width: 620px; margin: 0 auto; text-align: center;
          background: var(--panel); border: 1px solid var(--line); border-radius: 20px;
          padding: 40px 44px; box-shadow: 0 30px 60px -30px rgba(0,0,0,0.5);
        }
        .mlp-plain-card .mlp-sku { justify-content: center; }
        .mlp-plain-card p.mlp-desc { margin-left: auto; margin-right: auto; }
        .mlp-plain-card .mlp-banner-foot { justify-content: center; }
        .mlp-banner-card.mlp-align-right { margin: 0 24px 0 auto; text-align: right; }
        .mlp-banner-card.mlp-align-right .mlp-eyebrow { flex-direction: row-reverse; }
        .mlp-banner-card .mlp-sku { font-size: 11px; letter-spacing: 0.08em; color: var(--ink-softer); text-transform: uppercase; margin: 16px 0 8px; font-family: var(--body); font-weight: 600; }
        .mlp-banner-card h2 { font-size: clamp(28px, 4.2vw, 42px); margin: 0 0 16px; }
        .mlp-banner-card p.mlp-desc { color: var(--ink-soft); font-size: 15.5px; line-height: 1.65; margin: 0 0 26px; max-width: 46ch; }
        .mlp-banner-card.mlp-align-right p.mlp-desc { margin-left: auto; }
        .mlp-size-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 18px; }
        .mlp-banner-card.mlp-align-right .mlp-size-row { justify-content: flex-end; }
        .mlp-size-pill { font-family: var(--body); font-size: 12.5px; font-weight: 600; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--ink-soft); cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease; }
        .mlp-size-pill:hover { border-color: var(--cyan); color: var(--paper); }
        .mlp-size-pill[data-active="true"] { border-color: var(--cyan); background: rgba(0,245,212,0.1); color: var(--paper); }
        .mlp-banner-foot { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 4px; }
        .mlp-banner-card.mlp-align-right .mlp-banner-foot { justify-content: flex-end; }
        .mlp-banner-foot .mlp-price { font-family: var(--display); font-size: 26px; background: linear-gradient(90deg, var(--cyan), var(--pink)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .mlp-banner-photo { width: 100%; max-height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid var(--line); margin: 4px 0 0; display: block; }
        .mlp-video-link { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--ink-soft); text-decoration: none; border: 1px solid var(--line); padding: 8px 14px; border-radius: 999px; transition: border-color 0.15s ease, color 0.15s ease; margin-top: 14px; }
        .mlp-video-link:hover { border-color: #ff0000; color: var(--paper); }
        .mlp-video-link svg { flex-shrink: 0; }

        @media (max-width: 720px) {
          .mlp-lumina-banner, .mlp-acrylic-banner, .mlp-mirror-banner { min-height: 420px; justify-content: flex-start; }
          .mlp-banner-card { padding: 28px 24px; margin: 0 16px; }
          .mlp-banner-card.mlp-align-right { text-align: left; margin: 0 16px; }
          .mlp-banner-card.mlp-align-right .mlp-eyebrow { flex-direction: row; }
          .mlp-banner-card.mlp-align-right p.mlp-desc { margin-left: 0; }
          .mlp-banner-card.mlp-align-right .mlp-banner-foot { justify-content: flex-start; }
        }

        .mlp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
        @media (max-width: 780px) { .mlp-steps { grid-template-columns: 1fr; } }
        .mlp-step { padding: 34px 28px; border-right: 1px solid var(--line); }
        .mlp-step:last-child { border-right: none; }
        .mlp-step .mlp-step-num { font-family: var(--display); font-size: 15px; letter-spacing: 0.08em; color: var(--ink-softer); }
        .mlp-step h3 { font-family: var(--body); font-size: 18px; font-weight: 700; margin: 10px 0 8px; }
        .mlp-step p { color: var(--ink-soft); font-size: 14.5px; margin: 0; }

        .mlp-faq-item { border-bottom: 1px solid var(--line); }
        .mlp-faq-item:first-child { border-top: 1px solid var(--line); }
        .mlp-faq-q { width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 22px 4px; display: flex; justify-content: space-between; align-items: center; gap: 16px; color: var(--paper); font-family: var(--body); font-size: 16.5px; font-weight: 600; }
        .mlp-faq-q .mlp-plus { font-family: var(--display); font-size: 22px; color: var(--cyan); transition: transform 0.2s ease; flex-shrink: 0; }
        .mlp-faq-item[data-open="true"] .mlp-plus { transform: rotate(45deg); }
        .mlp-faq-a { max-height: 0; overflow: hidden; transition: max-height 0.25s ease; }
        .mlp-faq-item[data-open="true"] .mlp-faq-a { max-height: 240px; }
        .mlp-faq-a p { color: var(--ink-soft); font-size: 15px; padding: 0 4px 22px; margin: 0; max-width: 62ch; }

        .mlp-final-cta { text-align: center; border-radius: 28px; padding: 72px 32px; background: radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.25), transparent 70%), radial-gradient(60% 100% at 50% 100%, rgba(0,245,212,0.15), transparent 70%), var(--panel); border: 1px solid var(--line); }
        .mlp-final-cta h2 { font-size: clamp(32px, 5vw, 52px); margin-bottom: 16px; }
        .mlp-final-cta p { color: var(--ink-soft); font-size: 17px; margin-bottom: 32px; }
        .mlp-final-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        .mlp-quote-overlay { position: fixed; inset: 0; background: rgba(5,5,10,0.75); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .mlp-quote-modal { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; max-width: 440px; width: 100%; overflow: hidden; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.7); }
        .mlp-quote-head { padding: 20px 24px; border-bottom: 1px solid var(--line); display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .mlp-quote-head h3 { font-family: var(--body); font-size: 18px; font-weight: 700; margin: 0 0 4px; }
        .mlp-quote-head p { font-size: 13px; color: var(--ink-soft); margin: 0; }
        .mlp-quote-close { background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; }
        .mlp-quote-close:hover { color: var(--paper); }
        .mlp-quote-form { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
        .mlp-quote-form label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px; }
        .mlp-quote-form input, .mlp-quote-form textarea { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; color: var(--paper); font-family: var(--body); font-size: 14px; }
        .mlp-quote-form input:focus, .mlp-quote-form textarea:focus { outline: none; border-color: var(--cyan); }
        .mlp-quote-form textarea { resize: none; }
        .mlp-quote-submit { font-family: var(--body); font-weight: 700; font-size: 15px; padding: 12px; border-radius: 10px; border: none; cursor: pointer; background: linear-gradient(90deg, var(--violet), var(--pink)); color: #fff; }
        .mlp-quote-note { font-size: 12px; text-align: center; color: var(--ink-softer); margin: 0; }
        .mlp-quote-success { padding: 40px 24px; text-align: center; }
        .mlp-quote-success .mlp-check { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 999px; background: rgba(0,245,212,0.12); display: flex; align-items: center; justify-content: center; color: var(--cyan); }
        .mlp-quote-success h3 { font-family: var(--body); font-size: 18px; font-weight: 700; margin: 0 0 8px; }
        .mlp-quote-success p { font-size: 14px; color: var(--ink-soft); margin: 0 0 24px; }
      `}</style>

      <section className="mlp-hero">
        <div className="mlp-wrap mlp-hero-grid">
          <div>
            <span className="mlp-eyebrow">Fotonix</span>
            <h1>Design it.<br />Light it.<br /><em>Love it.</em></h1>
            <p className="mlp-lede">
              Custom LED mirrors, side-lit acrylic signs, and made-to-order shapes — designed
              by you, in minutes, from £29.99. No design skills needed.
            </p>
            <div className="mlp-hero-ctas">
              <a className="mlp-btn-primary" href="#products">Shop Products →</a>
              <a className="mlp-btn-ghost" href="#tools">Start Designing</a>
            </div>

            <div className="mlp-trust-row">
              <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="mlp-trust-badge" aria-label="Verified by Endorsed.Review">
                <svg viewBox="0 0 1400 300" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="1380" height="280" rx="70" fill="#FFD200" stroke="#0B0B0B" strokeWidth="14" strokeLinejoin="round" />
                  <g transform="translate(70,60)">
                    <rect width="180" height="180" rx="36" fill="#0B0B0B" />
                    <g transform="translate(90,90)">
                      <path d="M0,-58 L17,-18 L63,-18 L25,6 L37,48 L0,24 L-37,48 L-25,6 L-63,-18 L-17,-18 Z" fill="#FFD200" />
                    </g>
                  </g>
                  <text x="300" y="150" fontFamily="Inter, Arial, Helvetica, sans-serif" fontWeight="700" fontSize="120" fill="#0B0B0B" dominantBaseline="middle">
                    Endorsed.Review
                    <tspan fontFamily="Inter, Arial, Helvetica, sans-serif" fontSize="72" dx="-23" dy="-36">®</tspan>
                  </text>
                </svg>
              </a>
              <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="mlp-trust-chip">
                <svg className="mlp-trust-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .8l3.3 6.9 7.6 1.1-5.5 5.3 1.3 7.6L12 18.9 5.3 21.7 6.6 14 1.1 8.8l7.6-1.1L12 .8z" fill="#FFD200" /></svg>
                <span><b>4.8/5</b> · 1,218 reviews</span>
              </a>
            </div>
          </div>

          <div className="mlp-pattern-card">
            <div className="mlp-label"><span><span className="mlp-dot"></span>LIVE PATTERN — Moving Groups</span><span>25 cells</span></div>
            <div className="mlp-cellgrid">
              {heroCells.map((cell, i) => (
                <i key={i} style={{ background: cell.color, animationDelay: `${cell.delay}ms` }} />
              ))}
            </div>
            <div className="mlp-meta"><span>Brightness <b>80%</b></span><span>Speed <b>1.2×</b></span></div>
            <p className="mlp-caption">Create your own light patterns — or browse and download ones the community has shared.</p>
          </div>
        </div>
      </section>

      <div className="mlp-facts">
        <div className="mlp-wrap mlp-facts-row">
          <div className="mlp-fact"><span className="mlp-num">£29.99</span><span className="mlp-cap">to get started</span></div>
          <div className="mlp-fact"><span className="mlp-num">Any</span><span className="mlp-cap">shape, made to order</span></div>
          <div className="mlp-fact"><span className="mlp-num">Free App</span><span className="mlp-cap">with downloadable patterns</span></div>
          <div className="mlp-fact"><span className="mlp-num">100%</span><span className="mlp-cap">your own design</span></div>
        </div>
      </div>

      <section id="products">
        <div className="mlp-wrap">
          <div className="mlp-section-head">
            <span className="mlp-eyebrow">Shop</span>
            <h2>Five ways to light up your space</h2>
            <p>Real products, real prices — jump straight to any of them.</p>
          </div>

          <div className="mlp-quicklinks">
            <a className="mlp-quicklink" href="#lumina-banner"><span className="mlp-qdot" style={{ background: '#00f5d4' }} />{lumina.name.split(' - ')[0].split(' — ')[0]}</a>
            <a className="mlp-quicklink" href="#acrylic-banner"><span className="mlp-qdot" style={{ background: '#ec4899' }} />Acrylic Sign (Desk)</a>
            <a className="mlp-quicklink" href="#wall-acrylic"><span className="mlp-qdot" style={{ background: '#f5f3ff' }} />Acrylic Panel (Wall)</a>
            <a className="mlp-quicklink" href="#mirror-banner"><span className="mlp-qdot" style={{ background: '#8b5cf6' }} />Custom Shape Mirror</a>
          </div>

          <div className="mlp-stencil-teaser">
            <p>Also selling the <b>Stencil Generator</b> ({stencil.price}) — upload any photo, get a printable stencil. It gets its own dedicated page rather than sitting in this grid.</p>
            <a href="/tools/stencil-generator">Try the Stencil Generator →</a>
          </div>
        </div>
      </section>

      <section id="lumina-banner" className="mlp-lumina-banner">
        <div className="mlp-lumina-media">
          <video className="mlp-lumina-video" autoPlay muted loop playsInline poster={luminaBgPoster}>
            <source src={luminaBgVideo} type="video/mp4" />
          </video>
          <div className="mlp-lumina-overlay" />
        </div>
        <div className="mlp-wrap">
          <div className="mlp-banner-card mlp-align-right">
            <span className="mlp-banner-badge cyan">Bestseller</span>
            <span className="mlp-eyebrow">Made By A Real Customer</span>
            <img className="mlp-banner-photo" src={luminaMainPhoto} alt="LED Lumina Mirror, Amelia's Bedroom" />
            <div className="mlp-sku">{lumina.sku}</div>
            <h2>{lumina.name}</h2>
            <p className="mlp-desc">This Lumina Mirror lights up Amelia's bedroom every night — reflective glass, edge lighting, ready in days.</p>
            <div className="mlp-size-row">
              {LUMINA_SIZES.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  className="mlp-size-pill"
                  data-active={luminaSize === i}
                  onClick={() => setLuminaSize(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mlp-banner-foot">
              <span className="mlp-price">{LUMINA_SIZES[luminaSize].price}</span>
              <a className="mlp-btn-primary" href="#" onClick={(e) => { e.preventDefault(); goToProduct(lumina); }}>View Product →</a>
            </div>
            <a className="mlp-video-link" href="#" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="currentColor" /></svg>
              Watch on YouTube
            </a>
          </div>
        </div>
      </section>

      <section id="acrylic-banner" className="mlp-acrylic-banner">
        <div className="mlp-acrylic-media" />
        <div className="mlp-wrap">
          <div className="mlp-banner-card">
            <span className="mlp-banner-badge cyan">Cut To Shape · Desk Mounted</span>
            <span className="mlp-eyebrow">Made By A Real Customer</span>
            <div className="mlp-sku">{deskAcrylic.sku}</div>
            <h2>{deskAcrylic.name}</h2>
            <p className="mlp-desc">This "Glow Gossip" podcast sign was designed and lit entirely through our tool — your own logo, name, or wording, cut to shape and mounted on a weighted base for your desk or shelf.</p>
            <div className="mlp-size-row">
              {DESK_ACRYLIC_SIZES.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  className="mlp-size-pill"
                  data-active={deskAcrylicSize === i}
                  onClick={() => setDeskAcrylicSize(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mlp-banner-foot">
              <span className="mlp-price">{DESK_ACRYLIC_SIZES[deskAcrylicSize].price}</span>
              <a className="mlp-btn-primary" href="#" onClick={(e) => { e.preventDefault(); goToProduct(deskAcrylic); }}>Start Designing →</a>
            </div>
          </div>
        </div>
      </section>

      <section id="wall-acrylic" style={{ paddingTop: 0 }}>
        <div className="mlp-wrap">
          <div className="mlp-plain-card">
            <span className="mlp-banner-badge violet">Wall Mounted · Fixed 30×30cm</span>
            <div className="mlp-sku">{wallAcrylic.sku}</div>
            <h2>{wallAcrylic.name}</h2>
            <p className="mlp-desc">A fixed-size square panel, side-lit and mounted flat on the wall — not cut to shape like the desk sign above. Real photography of this one is coming soon.</p>
            <div className="mlp-banner-foot">
              <span className="mlp-price">{wallAcrylic.price}</span>
              <a className="mlp-btn-primary" href="#" onClick={(e) => { e.preventDefault(); goToProduct(wallAcrylic); }}>Start Designing →</a>
            </div>
          </div>
        </div>
      </section>

      <section id="mirror-banner" className="mlp-mirror-banner">
        <div className="mlp-mirror-media" />
        <div className="mlp-wrap">
          <div className="mlp-banner-card mlp-align-right">
            <span className="mlp-banner-badge violet">Made to Order</span>
            <span className="mlp-eyebrow">Made By A Real Customer</span>
            <div className="mlp-sku">{customMirror.sku}</div>
            <h2>{customMirror.name.split(' - ')[0].split(' — ')[0]}</h2>
            <p className="mlp-desc">"Amelia's Bedroom" — a custom-cut sign outlined exactly to the customer's design, not a stock rectangle. Outline whatever shape you want and we'll cut it to match.</p>
            <div className="mlp-banner-foot">
              <span className="mlp-price">{customMirror.price}</span>
              <a className="mlp-btn-primary" href="#" onClick={(e) => { e.preventDefault(); goToProduct(customMirror); }}>{customMirror.buttonLabel || 'Get Custom Quote'} →</a>
            </div>
          </div>
        </div>
      </section>

      <section id="tools" style={{ paddingTop: 0 }}>
        <div className="mlp-wrap">
          <div className="mlp-section-head">
            <span className="mlp-eyebrow">How it works</span>
            <h2>From idea to wall-mounted in three steps</h2>
          </div>
          <div className="mlp-steps">
            <div className="mlp-step">
              <span className="mlp-step-num">DESIGN</span>
              <h3>Open a designer</h3>
              <p>Pick colours, upload a photo, or choose a shape — our real tools do the rest, no design experience needed.</p>
            </div>
            <div className="mlp-step">
              <span className="mlp-step-num">PREVIEW</span>
              <h3>See it before you buy</h3>
              <p>Your design renders live so you know exactly what's arriving — no surprises.</p>
            </div>
            <div className="mlp-step">
              <span className="mlp-step-num">RECEIVE</span>
              <h3>Made to order, just for you</h3>
              <p>Every piece is cut, printed, or lit to your exact design — not pulled off a shelf.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" style={{ paddingTop: 0 }}>
        <div className="mlp-wrap" style={{ maxWidth: 760 }}>
          <div className="mlp-section-head" style={{ marginBottom: 8 }}>
            <span className="mlp-eyebrow">Questions</span>
            <h2>Before you order</h2>
          </div>
          <div>
            {FAQS.map(([q, a], i) => (
              <FaqItem
                key={q}
                q={q}
                a={a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mlp-wrap">
          <div className="mlp-final-cta">
            <h2>Ready to light up your space?</h2>
            <p>Real products, made to your design, from £29.99.</p>
            <div className="mlp-final-ctas">
              <a className="mlp-btn-primary" href="#products">Shop Products →</a>
              <a className="mlp-btn-ghost" href="#tools">See How It Works</a>
            </div>
          </div>
        </div>
      </section>

      {showQuoteModal && (
        <div className="mlp-quote-overlay" onClick={closeQuoteModal}>
          <div className="mlp-quote-modal" onClick={(e) => e.stopPropagation()}>
            {!quoteSubmitted ? (
              <>
                <div className="mlp-quote-head">
                  <div>
                    <h3>Get a Custom Quote</h3>
                    <p>{customMirror.name}</p>
                  </div>
                  <button className="mlp-quote-close" onClick={closeQuoteModal} aria-label="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form className="mlp-quote-form" onSubmit={handleQuoteSubmit}>
                  <div>
                    <label>Your Name *</label>
                    <input type="text" required value={quoteForm.name} onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })} placeholder="John Smith" />
                  </div>
                  <div>
                    <label>Email Address *</label>
                    <input type="email" required value={quoteForm.email} onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })} placeholder="john@example.com" />
                  </div>
                  <div>
                    <label>Phone Number</label>
                    <input type="tel" value={quoteForm.phone} onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })} placeholder="+44 7123 456789" />
                  </div>
                  <div>
                    <label>Describe Your Custom Mirror</label>
                    <textarea rows={3} value={quoteForm.description} onChange={(e) => setQuoteForm({ ...quoteForm, description: e.target.value })} placeholder="Shape, size, any special requirements..." />
                  </div>
                  <button type="submit" className="mlp-quote-submit">Request Quote</button>
                  <p className="mlp-quote-note">We'll get back to you within 24 hours with a personalised quote.</p>
                </form>
              </>
            ) : (
              <div className="mlp-quote-success">
                <div className="mlp-check">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3>Quote Request Received!</h3>
                <p>Thank you for your interest! We'll be in touch soon with your personalised quote.</p>
                <button className="mlp-quote-submit" onClick={closeQuoteModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
