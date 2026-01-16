import React from "react";

/**
 * CustomBlankTemplate.jsx
 * A minimalist starting point for custom funnels.
 * Clean gradient hero, centered layout, neutral palette.
 */

export default function CustomBlankTemplate() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-gray-100 text-gray-800">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-32 px-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
          Build Your Dream Funnel
        </h1>
        <p className="mt-4 max-w-2xl text-gray-600 text-lg">
          Start from a blank canvas — customize every block, color, and section
          to match your brand perfectly.
        </p>
        <div className="mt-8 flex gap-3">
          <a
            href="#get-started"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
          >
            Get Started
          </a>
          <a
            href="#learn"
            className="rounded-xl border border-indigo-200 px-6 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Placeholder CTA Section */}
      <section className="bg-white border-t py-20">
        <div className="mx-auto max-w-4xl text-center px-6">
          <h3 className="text-2xl font-semibold text-gray-900">
            Add Your First Block
          </h3>
          <p className="mt-2 text-gray-600">
            Use the Funnel Builder tools to insert blocks — hero, features, testimonials, or calls to action.
          </p>
          <div className="mt-6">
            <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 shadow">
              + Add Block
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500 border-t">
        Designed your way — no rules, just creativity.
      </footer>
    </div>
  );
}

/* ============================================================================
   getSchema() — Loads into FunnelBuilder.js as the blank layout starter
============================================================================= */
export function getSchema() {
  return {
    blocks: [
      {
        id: "hero-custom",
        type: "hero",
        data: {
          headline: "Build Your Dream Funnel",
          subhead:
            "Start from a blank canvas — customize every block to fit your brand.",
          ctaLabel: "Get Started",
          ctaSecondary: "Learn More",
          gradient: true,
          align: "center",
          image: "",
        },
      },
      {
        id: "cta-custom",
        type: "cta",
        data: {
          headline: "Add Your First Block",
          subhead:
            "Use the Funnel Builder tools to insert sections and design freely.",
          ctaLabel: "+ Add Block",
          theme: "light",
        },
      },
    ],
  };
}
