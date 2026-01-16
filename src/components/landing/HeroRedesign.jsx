import React from 'react';
import { motion } from 'framer-motion';

function PlainButton({ children, variant = 'solid', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-2xl transition';
  const solid = 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white';
  const outline = 'bg-transparent border border-gray-300 text-gray-700';
  return (
    <button className={`${base} ${variant === 'solid' ? solid : outline} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default function HeroRedesign() {
  return (
    <section className="relative w-full bg-gradient-to-b from-white to-purple-50 overflow-hidden">
      {/* Promo Bar */}
      {/* <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-center py-2 text-sm font-semibold">
        ⚡ 20% OFF this week — Ends Sunday <span className="opacity-80 ml-2">0d 14:13:25</span>
      </div> */}

      {/* Hero Grid */}
  <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-16 grid md:grid-cols-2 gap-10 items-start">
        {/* Left Copy Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight">
            Fotonix LED <br />Neon Mirror
          </h1>
          <p className="text-lg text-gray-600 max-w-lg">
            Create stunning personalized LED neon mirrors with our easy-to-use design tool. Perfect for bedrooms, events, or gifts - bring your ideas to life with premium quality and vibrant colors.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-fuchsia-500 rounded-full"></span>
                <span className="font-medium">Custom Design Tool</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="font-medium">Premium LED Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="font-medium">Multiple Sizes Available</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="font-medium">Fast UK Shipping</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span className="font-medium">Easy Installation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="font-medium">Perfect Gift Option</span>
              </div>
            </div>
          </div>

          {/* CTAs moved to appear beneath the hero image on the right column */}

          {/* CTAs for mobile: show under image on small screens as well as under image on desktop */}
        </motion.div>

        {/* (social proof will be rendered after the image so the photo stays aligned with the copy) */}

        {/* Right Image with floating glass CTA */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="hero-media">
            <img
              src="/images/AmeliaBedroom.png"
              alt="Fotonix LED Neon Mirror showing a personalized design"
              className="hero-img"
              decoding="async"
              fetchPriority="high"
            />

            {/* floating CTA (stays inside on desktop, docks below on mobile) */}
            <motion.a
              href="#product"
              aria-label="Design your mirror now"
              className="floating-cta"
              onClick={(e) => { e.preventDefault(); try { window.location.href = '/#product'; } catch(e){} }}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ delay: 0.6, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
              whileHover={{ y: -2, scale: 1.02 }}
              whileFocus={{ scale: 1.02 }}
            >
              <span className="dot" aria-hidden="true"></span>
              <span>Design Your Mirror</span>
            </motion.a>
          </div>

          {/* Buttons that sit beneath the photo */}
          <div className="mt-6 flex justify-center md:justify-start md:mt-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <PlainButton variant="solid" className="text-lg px-8 py-4 shadow-md" onClick={() => { try { window.location.hash = 'product'; } catch(e){} }}>
                Start Your Design
              </PlainButton>
              <PlainButton variant="outline" className="text-lg px-8 py-4" onClick={() => { try { window.location.hash = 'about'; } catch(e){} }}>
                Learn More
              </PlainButton>
              <div className="text-center sm:text-left">
                <div className="text-xs text-gray-500 mt-2">
                  <span className="font-semibold text-fuchsia-600">Free Design Tool</span> • Fast Shipping • Premium Quality
                </div>
              </div>
            </div>
          </div>

            {/* Social proof: centered on mobile, left-aligned on md+ to match Start button */}
            <div className="trust-row mt-4 md:mt-5 flex flex-col gap-3 md:flex-row md:items-center justify-center">

  {/* Endorsed.Review badge (kept as your SVG file) */}
  <a
    href="https://endorsed.review/biz/fotonix"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center endorsed-badge"
    aria-label="Verified by Endorsed.Review – see profile"
  >
    <img
      src="/endorsedborder.svg"
      alt="Endorsed.Review"
      className="h-10 w-auto md:h-11 mr-0 flex-shrink-0"
    />
   
    <span className="sr-only">Endorsed.Review registered trademark</span>
  </a>

  {/* Divider */}
  <span className="hidden md:block h-5 w-px bg-gray-300/80 mx-3" aria-hidden="true"></span>

  {/* Option B: compact rating chip — container + separate links to avoid nested anchors */}
  <div className="group inline-flex items-center gap-1.5 rounded-full border border-gray-300/70 bg-white/70 px-2.5 py-1 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur transition hover:border-yellow-400 hover:bg-white">
    <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD43B] focus-visible:ring-offset-2">
      <svg className="h-3.5 w-3.5 text-yellow-400 transition group-hover:scale-105" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .8l3.3 6.9 7.6 1.1-5.5 5.3 1.3 7.6L12 18.9 5.3 21.7 6.6 14 1.1 8.8l7.6-1.1L12 .8z" fill="currentColor"/>
      </svg>
      <span className="text-sm font-semibold">4.8/5</span>
    </a>
    <span className="mx-1 text-gray-300">·</span>
    <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="inline-flex flex-col items-center text-gray-700 underline-offset-4 group-hover:underline decoration-[#FFD43B] px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD43B] focus-visible:ring-offset-2">
      <span className="block text-center leading-tight">1,218</span>
      <span className="block text-center text-xs text-gray-600 -mt-0.5">reviews</span>
    </a>
  </div>

</div>

          <style>{`
            .hero-media { position: relative; border-radius: 22px; overflow: clip; }
            .hero-img { display: block; width: 100%; height: auto; border-radius: 22px; }

            .floating-cta {
              position: absolute;
              right: min(24px, 3vw);
              bottom: min(24px, 3vw);
              display: inline-flex;
              align-items: center;
              gap: 10px;
              padding: 12px 16px;
              border-radius: 999px;
              text-decoration: none;
              font-weight: 600;
              color: #111;
              background: rgba(255,255,255,0.82);
              -webkit-backdrop-filter: blur(10px);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255,255,255,0.6);
              box-shadow: 0 8px 24px rgba(17,17,17,0.12), inset 0 0 0 1px rgba(17,17,17,0.04);
              transform: translateZ(0);
              transition: transform .22s cubic-bezier(.2,.7,.2,1), box-shadow .22s ease, background .22s ease;
              min-height: 44px;
              padding-left: 16px;
              padding-right: 18px;
            }

            .floating-cta .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff4d6d; box-shadow: 0 0 0 0 rgba(255,77,109,0.5); animation: ping 1.8s infinite; }
            @keyframes ping { 0% { box-shadow: 0 0 0 0 rgba(255,77,109,0.5); } 70% { box-shadow: 0 0 0 10px rgba(255,77,109,0); } 100% { box-shadow: 0 0 0 0 rgba(255,77,109,0); } }

            .floating-cta:hover { transform: translateY(-2px) scale(1.02); }
            .floating-cta:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,212,59,0.95), 0 8px 24px rgba(17,17,17,0.12); }

            @media (prefers-reduced-motion: reduce) { .floating-cta { transition: none; } .floating-cta .dot { animation: none; } }

            /* mobile: dock below image, full width pill */
            @media (max-width: 768px) {
              .floating-cta { position: static; margin: 12px auto 0; width: clamp(260px, 90%, 520px); justify-content: center; }
            }

            /* safe inset: ensure the pill never touches edges when container shrinks */
            @media (min-width: 769px) {
              .hero-media { padding: 0; }
              .floating-cta { right: min(24px, 3vw); bottom: min(24px, 3vw); }
            }

            /* accessibility: ensure focusable tap-target */
            .floating-cta { -webkit-tap-highlight-color: rgba(0,0,0,0); }

            /* tiny utility classes used by the trust row */
            .h-4\.5 { height: 1.125rem; }
            .w-4\.5 { width: 1.125rem; }

            /* hover / focus for the Endorsed.Review badge */
            .endorsed-badge { transition: transform .16s ease, box-shadow .16s ease; border-radius: 6px; }
            .endorsed-badge img { display: block; }
            .endorsed-badge:hover, .endorsed-badge:focus-visible { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(17,17,17,0.12); }
            @media (prefers-reduced-motion: reduce) { .endorsed-badge, .endorsed-badge img { transition: none; } .endorsed-badge:hover { transform: none; box-shadow: none; } }

            /* TM superscript styling */
            .tm-sup { font-size: 0.6em; line-height: 1; vertical-align: super; color: #6b7280; }
          `}</style>
        </motion.div>
      </div>
    </section>
  );
}
