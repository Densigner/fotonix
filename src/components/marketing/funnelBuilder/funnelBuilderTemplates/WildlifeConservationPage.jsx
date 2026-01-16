import React from "react";

export default function WildlifeConservationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 text-gray-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop"
          alt="Elephant wildlife"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-emerald-900/70" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold">
            Protecting Nature’s Giants
          </h1>
          <p className="mt-4 text-lg text-white/90">
            Your voice can help preserve wildlife and their natural habitats.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="#donate"
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Donate Now
            </a>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold">Our Impact</h2>
          <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
            Working across Africa and Asia to protect endangered species
            through community action and conservation technology.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: "Anti-Poaching Patrols",
              desc: "On-ground teams protecting endangered wildlife from illegal trade.",
              icon: "🦏",
            },
            {
              title: "Habitat Restoration",
              desc: "Reforesting ecosystems to give wildlife their homes back.",
              icon: "🌳",
            },
            {
              title: "Community Education",
              desc: "Empowering locals with conservation awareness and training.",
              icon: "👩‍🏫",
            },
          ].map((m, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="text-4xl mb-3">{m.icon}</div>
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="mt-1 text-gray-600 text-sm">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="donate" className="bg-emerald-800 py-20 text-center text-white">
        <h3 className="text-3xl font-semibold">Join the Conservation Effort</h3>
        <p className="mt-2 text-white/80 max-w-xl mx-auto">
          Every donation directly supports field operations and community programs.
        </p>
        <div className="mt-6">
          <button className="rounded-lg bg-white text-emerald-800 px-6 py-3 font-semibold hover:bg-white/90">
            Donate Today
          </button>
        </div>
      </section>
    </div>
  );
}

export function getSchema() {
  return {
    blocks: [
      // HERO SECTION
      {
        id: "wildlife-hero",
        type: "hero",
        data: {
          anchorId: "top",
          headline: "Protecting Nature’s Giants",
          subhead:
            "Your voice can help preserve wildlife and their natural habitats.",
          ctaLabel: "Donate Now",
          ctaHref: "#donate",
          align: "center",
          gradientOverlay: true,
          gradientColor: "emerald-900/70",
          textColor: "white",
          image:
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
        },
      },

      // IMPACT / MISSION INTRO
      {
        id: "wildlife-impact-heading",
        type: "heading",
        data: {
          anchorId: "impact",
          text: "Our Impact",
          size: 36,
          align: "center",
        },
      },
      {
        id: "wildlife-impact-paragraph",
        type: "paragraph",
        data: {
          text:
            "Working across Africa and Asia to protect endangered species through community action and conservation technology.",
          width: 720,
          align: "center",
        },
      },

      // FEATURES GRID
      {
        id: "wildlife-features",
        type: "features",
        data: {
          title: "",
          items: [
            {
              id: "wf-1",
              title: "🦏 Anti-Poaching Patrols",
              desc:
                "On-ground teams protecting endangered wildlife from illegal trade.",
            },
            {
              id: "wf-2",
              title: "🌳 Habitat Restoration",
              desc:
                "Reforesting ecosystems to give wildlife their homes back.",
            },
            {
              id: "wf-3",
              title: "👩‍🏫 Community Education",
              desc:
                "Empowering locals with conservation awareness and training.",
            },
          ],
        },
      },

      // CTA / DONATION SECTION
      {
        id: "wildlife-cta-donate",
        type: "cta",
        data: {
          anchorId: "donate",
          headline: "Join the Conservation Effort",
          subhead:
            "Every donation directly supports field operations and community programs.",
          ctaLabel: "Donate Today",
          ctaHref: "#",
          theme: "dark",
          background: {
            color: "emerald-800",
          },
          textColor: "white",
        },
      },
    ],
  };
}
