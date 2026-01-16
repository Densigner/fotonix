import React from "react";

/**
 * LawFirmLanding.jsx
 * - Live preview component used in the Templates gallery.
 * - The canonical template schema lives in the template registry; this file
 *   only contains the visual preview component (no exported getSchema()).
 */

export default function LawFirmLanding() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1555371363-3b0d6d0f0a78?q=80&w=1600&auto=format&fit=crop"
          alt="Law library"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <nav className="mb-10 flex items-center justify-between text-slate-100/90">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-6 w-6"><path fill="currentColor" d="M12 2l7 4v12l-7 4-7-4V6l7-4m0 2.2L7 6.5v10.9l5 2.9 5-2.9V6.5l-5-2.3Z"/></svg>
              <span className="font-semibold tracking-wide">Lex & Partners</span>
            </div>
            <ul className="hidden md:flex items-center gap-6 text-sm">
              <li className="hover:text-white transition">About</li>
              <li className="hover:text-white transition">Practice Areas</li>
              <li className="hover:text-white transition">Team</li>
              <li className="hover:text-white transition">Contact</li>
            </ul>
            <a
              href="#consult"
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
            >
              Book Consultation
            </a>
          </nav>

          <div className="max-w-3xl text-white">
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Modern Legal Counsel for Business & Life
            </h1>
            <p className="mt-4 text-white/90 md:text-lg">
              Strategic, responsive, and relentless advocacy. From corporate law to
              family matters, our team brings decades of experience and care.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-8 flex w-full max-w-md rounded-xl bg-white/95 p-1 shadow backdrop-blur"
            >
              <input
                className="flex-1 rounded-l-xl border-0 px-3 py-3 text-sm text-gray-900 placeholder-gray-500 outline-none"
                placeholder="Your email"
              />
              <button
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
                type="button"
              >
                Get Case Review
              </button>
            </form>

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <ShieldIcon /> <span>Over 2,400 cases won</span>
              </div>
              <div className="flex items-center gap-2">
                <StarIcon /> <span>Rated 4.9/5 by clients</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon /> <span>24/7 priority support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Practice Areas */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Practice Areas
          </h2>
          <p className="mt-2 text-gray-600">
            Deep domain expertise across business, personal, and litigation.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Corporate & Commercial",
              desc: "M&A, governance, contracts, compliance, and strategic advisory.",
              icon: <BriefcaseIcon />,
            },
            {
              title: "Family & Divorce",
              desc: "Compassionate, pragmatic guidance for complex family matters.",
              icon: <HeartIcon />,
            },
            {
              title: "Real Estate & Property",
              desc: "Acquisitions, leasing, development, and dispute resolution.",
              icon: <HomeIcon />,
            },
            {
              title: "Employment Law",
              desc: "Policies, disputes, terminations, and executive compensation.",
              icon: <UsersIcon />,
            },
            {
              title: "Dispute Resolution",
              desc: "Litigation strategy, mediation, settlements, and arbitration.",
              icon: <GavelIcon />,
            },
            {
              title: "Intellectual Property",
              desc: "Trademark, copyright, licensing, and portfolio management.",
              icon: <LightbulbIcon />,
            },
          ].map((card, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{card.desc}</p>
              <button className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Learn more →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial band */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14 text-center">
          <p className="text-indigo-600">Client Testimonial</p>
          <blockquote className="mt-3 text-xl md:text-2xl font-medium text-slate-800">
            “They were meticulous, fast, and genuinely invested in our success.
            The ideal partner for high-stakes decisions.”
          </blockquote>
          <div className="mt-3 text-sm text-gray-500">— Jordan Miller, COO</div>
        </div>
      </section>

      {/* CTA */}
      <section id="consult" className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-8 md:p-12 text-white">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-2xl font-semibold md:text-3xl">
                Ready for a strategic first step?
              </h3>
              <p className="mt-2 text-white/90">
                Book a free 30-minute consultation. We’ll listen, assess, and
                suggest the best path forward.
              </p>
            </div>
            <div className="flex justify-start md:justify-end">
              <a
                href="#"
                className="rounded-xl bg-white px-5 py-3 font-medium text-slate-900 shadow hover:bg-white/90"
              >
                Book Your Consultation
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-gray-500">
          © {new Date().getFullYear()} Lex & Partners. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* ================= Icons (inline, lightweight) ================= */
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2l7 4v6c0 5-3.5 8.1-7 10-3.5-1.9-7-5-7-10V6l7-4z" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 1a11 11 0 100 22 11 11 0 000-22zm.5 6h-2v7l6 3 .9-1.8-4.9-2.2V7z" />
    </svg>
  );
}
function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M10 2h4a2 2 0 012 2v2h4a2 2 0 012 2v3H2V8a2 2 0 012-2h4V4a2 2 0 012-2zm-2 4h8V4h-2V3h-4v1H8v2zM2 13h20v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5zm10 1a3 3 0 00-3 3h6a3 3 0 00-3-3z" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12.1 21l-1.1-1C5 15 2 12.2 2 8.9 2 6.2 4.2 4 6.9 4c1.6 0 3.1.8 4.1 2.1C12.9 4.8 14.4 4 16 4c2.7 0 4.9 2.2 4.9 4.9 0 3.3-3 6.1-9 11.1l-1.8 1z" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M16 11c1.9 0 3.5-1.6 3.5-3.5S17.9 4 16 4s-3.5 1.6-3.5 3.5S14.1 11 16 11zM8 11c1.9 0 3.5-1.6 3.5-3.5S9.9 4 8 4 4.5 5.6 4.5 7.5 6.1 11 8 11zm8 2c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3zM8 13c-2.3 0-7 1.2-7 3.5V19h7v-3h2v3h7v-2.5C17 14.2 12.3 13 10 13H8z" />
    </svg>
  );
}
function GavelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M5.2 16.5L14 7.7l2.3 2.3-8.8 8.8H5.2v-2.3zM20.3 8.1l-1.9 1.9-2.3-2.3 1.9-1.9c.6-.6 1.6-.6 2.3 0 .6.6.6 1.6 0 2.3zM2 20h12v2H2v-2z" />
    </svg>
  );
}
function LightbulbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M9 21h6v-1H9v1zm3-20a7 7 0 00-4 12.9V16a1 1 0 001 1h6a1 1 0 001-1v-2.1A7 7 0 0012 1z" />
    </svg>
  );
}
