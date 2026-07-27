import React from "react";

export default function WomanEmpowermentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-white text-gray-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1495837174058-628aafc7d610?q=80&w=1600&auto=format&fit=crop"
          alt="Women Empowerment"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-rose-900/70" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold">
            Empowering Women, Shaping the Future
          </h1>
          <p className="mt-4 text-lg text-white/90">
            Creating equal opportunities and leadership for women everywhere.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="#join"
              className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-400"
            >
              Join the Movement
            </a>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold">Our Programs</h2>
          <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
            We support women through education, entrepreneurship, and mentorship.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: "Education Access", desc: "Scholarships and learning programs.", icon: "🎓" },
            { title: "Entrepreneurship", desc: "Funding and mentorship for startups.", icon: "💼" },
            { title: "Leadership", desc: "Workshops for confident leadership.", icon: "🌟" },
          ].map((m, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="text-4xl mb-3">{m.icon}</div>
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="mt-1 text-gray-600 text-sm">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="join" className="bg-rose-600 py-20 text-center text-white">
        <h3 className="text-3xl font-semibold">Join the Movement</h3>
        <p className="mt-2 text-white/80 max-w-xl mx-auto">
          Together, we can create lasting impact and equality.
        </p>
        <div className="mt-6">
          <button className="rounded-lg bg-white text-rose-600 px-6 py-3 font-semibold hover:bg-white/90">
            Get Involved
          </button>
        </div>
      </section>
    </div>
  );
}

export function getSchema() {
  return {
    blocks: [
      {
        id: "hero-women",
        type: "hero",
        data: {
          headline: "Empowering Women, Shaping the Future",
          subhead: "Creating equal opportunities and leadership for women.",
          ctaLabel: "Join the Movement",
          image:
            "https://images.unsplash.com/photo-1495837174058-628aafc7d610?q=80&w=1600&auto=format&fit=crop",
          gradient: true,
          align: "center",
        },
      },
      {
        id: "features-women",
        type: "features",
        data: {
          title: "Our Programs",
          items: [
            { id: 1, title: "Education Access", desc: "Scholarships and learning." },
            { id: 2, title: "Entrepreneurship", desc: "Funding and mentorship." },
            { id: 3, title: "Leadership", desc: "Workshops and advocacy." },
          ],
        },
      },
      {
        id: "cta-women",
        type: "cta",
        data: {
          headline: "Join the Movement",
          subhead: "Together, we can create lasting impact.",
          ctaLabel: "Get Involved",
          theme: "dark",
        },
      },
    ],
  };
}
