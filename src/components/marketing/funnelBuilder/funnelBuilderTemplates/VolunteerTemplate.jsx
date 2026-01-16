import React from "react";
import volunHero from "./volunhero.png";

export default function VolunteerTemplate() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={volunHero}
          alt="Volunteer background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-emerald-900/70" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Together, We Can Make a Difference
          </h1>
          <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">
            Join our community of volunteers and bring positive change to people’s lives.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="#signup"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-400"
            >
              Become a Volunteer
            </a>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold">Our Mission</h2>
          <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
            Empower communities through volunteer-led initiatives in education,
            environment, and health.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: "Education for All",
              desc: "Support underprivileged students with mentorship and resources.",
              icon: "📚",
            },
            {
              title: "Environmental Action",
              desc: "Join cleanup drives, tree planting, and sustainability campaigns.",
              icon: "🌳",
            },
            {
              title: "Health Outreach",
              desc: "Assist medical camps and health awareness programs.",
              icon: "❤️",
            },
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
      <section id="signup" className="bg-emerald-50 py-20">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h3 className="text-2xl font-semibold text-emerald-900">
            Start Your Volunteer Journey
          </h3>
          <p className="mt-2 text-gray-600">
            Sign up today and become part of our growing volunteer family.
          </p>
          <form className="mt-6 flex justify-center gap-3">
            <input
              className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
            <button className="rounded-lg bg-emerald-600 px-5 py-2 text-sm text-white hover:bg-emerald-500">
              Join Now
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

export function getSchema() {
  return {
    blocks: [
      // HERO (uses your custom volunteerHero block so we keep header/overlay/centered layout)
      {
        id: "vol-hero-1",
        type: "volunteerHero",
        data: {
          showHeader: false,
          logoText: "VOLUNTEER",
          links: ["Home", "About", "Opportunities", "How to Volunteer", "Contact"],
          ctaLabel: "Become a Volunteer",
          ctaHref: "#signup",
          headline: "Together, We Can Make a Difference",
          subhead:
            "Join our community of volunteers and bring positive change to people’s lives.",
          buttonLabel: "Become a Volunteer",
          buttonHref: "#signup",
          placeholder: "Email",
          // Use your local asset path or a hosted URL:
          // e.g. "/templates/volunhero.png" or a CDN/Unsplash image
          background: "/templates/volunhero.png",
          overlay: true,
          darkText: false,
          align: "center",
        },
      },

      // MISSION – title
      {
        id: "vol-mission-heading",
        type: "heading",
        data: {
          text: "Our Mission",
          size: 36,
          align: "center",
        },
      },

      // MISSION – lead paragraph
      {
        id: "vol-mission-paragraph",
        type: "paragraph",
        data: {
          text:
            "Empower communities through volunteer-led initiatives in education, environment, and health.",
          width: 720,
          align: "center",
        },
      },

      // MISSION – 3-card grid (map emojis into titles so they show up)
      {
        id: "vol-mission-features",
        type: "features",
        data: {
          title: "",
          items: [
            {
              id: "m-edu",
              title: "📚 Education for All",
              desc: "Support underprivileged students with mentorship and resources.",
            },
            {
              id: "m-env",
              title: "🌳 Environmental Action",
              desc: "Join cleanup drives, tree planting, and sustainability campaigns.",
            },
            {
              id: "m-health",
              title: "❤️ Health Outreach",
              desc: "Assist medical camps and health awareness programs.",
            },
          ],
        },
      },

      // SIGNUP CTA (email capture)
      {
        id: "vol-cta-signup",
        type: "emailCapture",
        data: {
          headline: "Start Your Volunteer Journey",
          placeholder: "you@example.com",
          button: "Join Now",
          success: "Thanks — we’ll be in touch soon!",
        },
      },
    ],
  };
}
