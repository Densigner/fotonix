import { lazy } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Lazy preview components (pointing to your existing template files)
export const TEMPLATE_META = {
  lawfirm: {
    id: 'lawfirm',
    name: 'Law Firm Landing',
    preview: lazy(() => import('./funnelBuilderTemplates/LawFirmLanding')),
  },
  volunteer: {
    id: 'volunteer',
    name: 'Volunteer Page',
    preview: lazy(() => import('./funnelBuilderTemplates/VolunteerTemplate')),
  },
  wildlife: {
    id: 'wildlife',
    name: 'Wildlife Conservation',
    preview: lazy(() => import('./funnelBuilderTemplates/WildlifeConservationPage')),
  },
  women: {
    id: 'women',
    name: 'Women Empowerment',
    preview: lazy(() => import('./funnelBuilderTemplates/WomenEmpowermentPage')),
  },
  custom: {
    id: 'custom',
    name: 'Blank',
    preview: lazy(() => import('./funnelBuilderTemplates/CustomBlankTemplate')),
  },
};

export function getStarterBlocks(templateId) {
  switch (templateId) {
    case 'lawfirm':
      return [
        {
          type: 'hero',
          data: {
            headline: 'Expert Legal Counsel',
            subhead: 'Trusted, results-driven advice for individuals and businesses.',
            ctaLabel: 'Book Consultation',
            ctaHref: '#consult',
            image: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?q=80&w=1600&auto=format&fit=crop',
            align: 'left',
            gradient: true,
          },
        },
        {
          type: 'features',
          data: {
            title: 'Areas of Expertise',
            items: [
              { id: uuidv4(), title: 'Corporate Law', desc: 'Entity setup, contracts & M&A.' },
              { id: uuidv4(), title: 'Family Law', desc: 'Divorce, settlements & custody.' },
              { id: uuidv4(), title: 'Commercial', desc: 'Litigation & dispute resolution.' },
            ],
          },
        },
        {
          type: 'emailCapture',
          data: {
            headline: 'Request a Free Case Review',
            placeholder: 'you@company.com',
            button: 'Request review',
            success: "Thanks! We'll get back to you shortly.",
          },
        },
      ];

    case 'volunteer':
      // Use the canonical volunteer schema defined below
      return getVolunteerSchema().blocks;
    case 'wildlife':
      // Use the canonical wildlife schema defined below so the editor
      // hydrates the full multi-block starter (hero, heading, paragraph,
      // features, cta) when the Wildlife template is selected.
      return getWildlifeSchema().blocks;

    case 'women':
      // Use the canonical women schema defined below so the editor
      // hydrates the full multi-block starter when the Women template is selected.
      return getWomenSchema().blocks;

    case 'webinar':
      // Canonical schema for the Create Funnel modal's "Run an evergreen
      // webinar" goal — see getWebinarSchema() below.
      return getWebinarSchema().blocks;

    case 'audience':
      // "Build an audience" goal from the Create Funnel modal.
      return [
        {
          type: 'hero',
          data: {
            headline: 'Grow an Audience That Actually Shows Up',
            subhead: "Get first access to new videos, drops, and behind-the-scenes content — straight to your inbox.",
            actionType: 'subscribe',
            ctaLabel: 'Join the List',
            image: '/images/AmeliaBedroom.png',
            align: 'center',
            gradient: true,
          },
        },
        {
          type: 'features',
          data: {
            title: "Why join",
            items: [
              { id: uuidv4(), title: 'Early access', desc: 'Be first to know when something new drops.' },
              { id: uuidv4(), title: 'No spam, ever', desc: "Just the good stuff, only when there's something worth sharing." },
              { id: uuidv4(), title: 'Unsubscribe anytime', desc: 'One click, no questions asked.' },
            ],
          },
        },
        {
          type: 'emailCapture',
          data: {
            headline: 'Get on the list',
            placeholder: 'you@example.com',
            button: 'Join Now',
            success: "You're in! Check your inbox.",
          },
        },
      ];

    case 'sell':
      // "Sell a product or a service" goal from the Create Funnel modal.
      return [
        {
          type: 'hero',
          data: {
            headline: 'Introducing Something New',
            subhead: 'The thing your audience has been asking for — finally here.',
            actionType: 'link',
            ctaLabel: 'Get It Now',
            ctaHref: '#',
            image: '/images/products/lucasroom.jpg',
            align: 'left',
            gradient: true,
          },
        },
        {
          type: 'features',
          data: {
            title: 'Why people love it',
            items: [
              { id: uuidv4(), title: 'Made for you', desc: 'Built around exactly what your audience already asks for.' },
              { id: uuidv4(), title: 'Simple to use', desc: 'No learning curve — works the way you already expect.' },
              { id: uuidv4(), title: 'Backed by you', desc: 'Trusted because you’re the one recommending it.' },
            ],
          },
        },
        {
          type: 'cta',
          data: {
            headline: 'Ready to grab yours?',
            subhead: '',
            ctaLabel: 'Get It Now',
            ctaHref: '#',
            actionType: 'link',
            theme: 'dark',
            background: { color: 'indigo-600' },
            align: 'center',
          },
        },
      ];

    case 'custom':
      // Explicit "start from scratch" — genuinely empty, not the generic
      // single-hero fallback in `default:` below.
      return [];

    default:
      return [
        {
          type: 'hero',
          data: {
            headline: 'Start from Scratch',
            subhead: 'Add blocks from the left to build your funnel.',
            ctaLabel: 'Get Started',
            ctaHref: '#',
            image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600&auto=format&fit=crop',
            align: 'center',
            gradient: true,
          },
        },
      ];
  }
}

/* ============================================================================
   Volunteer – schema matching the JSX exactly (canonical schema for the volunteer template)
============================================================================ */
export function getVolunteerSchema() {
  return {
    blocks: [
      // HERO (full-bleed image, emerald overlay, centered CTA)
      {
        id: "vol-hero",
        type: "volunteerHero",
        data: {
          anchorId: "top",
          showHeader: false,
          logoText: "VOLUNTEER",
          links: [],
          headline: "Together, We Can Make a Difference",
          subhead:
            "Join our community of volunteers and bring positive change to people’s lives.",
          // Primary CTA
          ctaLabel: "Become a Volunteer",
          ctaHref: "#signup",
          // Inline form in this block is unused here (kept off)
          buttonLabel: "",
          buttonHref: "",
          placeholder: "",
          // Background image (use public path or remote URL)
          background: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1600&auto=format&fit=crop",
          overlay: true,
          darkText: false,
          align: "center",
        },
      },

      // MISSION — title
      {
        id: "vol-mission-title",
        type: "heading",
        data: {
          anchorId: "mission",
          text: "Our Mission",
          size: 36,
          align: "center",
        },
      },

      // MISSION — lead paragraph
      {
        id: "vol-mission-lead",
        type: "paragraph",
        data: {
          text:
            "Empower communities through volunteer-led initiatives in education, environment, and health.",
          width: 720,
          align: "center",
        },
      },

      // MISSION — three initiative cards
      {
        id: "vol-initiatives",
        type: "features",
        data: {
          title: "",
          items: [
            {
              id: "edu",
              title: "📚 Education for All",
              desc:
                "Support underprivileged students with mentorship and resources.",
            },
            {
              id: "env",
              title: "🌳 Environmental Action",
              desc:
                "Join cleanup drives, tree planting, and sustainability campaigns.",
            },
            {
              id: "health",
              title: "❤️ Health Outreach",
              desc:
                "Assist medical camps and health awareness programs.",
            },
          ],
        },
      },

      // SIGNUP CTA (email capture section)
      {
        id: "vol-signup",
        type: "emailCapture",
        data: {
          anchorId: "signup",
          headline: "Start Your Volunteer Journey",
          placeholder: "you@example.com",
          button: "Join Now",
          success: "Thanks — we’ll be in touch soon!",
        },
      },
    ],
  };
}

/* ============================================================================
   Wildlife – canonical starter schema for the Wildlife Conservation template
============================================================================ */
export function getWildlifeSchema() {
  return {
    blocks: [
      // HERO (emerald overlay, center CTA)
      {
        id: "wild-hero",
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
          font: {
            heading: "serif",
            body: "sans",
          },
          image:
            "https://images.unsplash.com/photo-1508817628294-5a453fa0b8fb?q=80&w=1600&auto=format&fit=crop",
        },
      },

      // IMPACT INTRO (title + lead)
      {
        id: "wild-impact-heading",
        type: "heading",
        data: {
          anchorId: "impact",
          text: "Our Impact",
          size: 36,
          align: "center",
        },
      },
      {
        id: "wild-impact-text",
        type: "paragraph",
        data: {
          text:
            "Working across Africa and Asia to protect endangered species through community action and conservation technology.",
          width: 740,
          align: "center",
        },
      },

      // FEATURES GRID (3 initiatives)
      {
        id: "wild-initiatives",
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
        id: "wild-donate",
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
          align: "center",
          padding: "py-20",
        },
      },
    ],
  };
}

/* ============================================================================
   Women Empowerment – canonical starter schema for the Women template
============================================================================ */
export function getWomenSchema() {
  return {
    blocks: [
      // HERO — full-bleed image, rose overlay, centered CTA
      {
        id: "women-hero",
        type: "hero",
        data: {
          anchorId: "top",
          headline: "Empowering Women, Shaping the Future",
          subhead:
            "Creating equal opportunities and leadership for women everywhere.",
          ctaLabel: "Join the Movement",
          ctaHref: "#join",
          align: "center",
          gradientOverlay: true,
          gradientColor: "rose-900/70",
          textColor: "white",
          image:
            "https://images.unsplash.com/photo-1495837174058-628aafc7d610?q=80&w=1600&auto=format&fit=crop",
        },
      },

      // PROGRAMS — section heading + lead
      {
        id: "women-programs-heading",
        type: "heading",
        data: {
          anchorId: "programs",
          text: "Our Programs",
          size: 36,
          align: "center",
        },
      },
      {
        id: "women-programs-lead",
        type: "paragraph",
        data: {
          text:
            "We support women through education, entrepreneurship, and mentorship.",
          width: 720,
          align: "center",
        },
      },

      // PROGRAMS — three cards (emojis inline)
      {
        id: "women-programs-grid",
        type: "features",
        data: {
          title: "",
          items: [
            {
              id: "wp-1",
              title: "🎓 Education Access",
              desc: "Scholarships and learning programs.",
            },
            {
              id: "wp-2",
              title: "💼 Entrepreneurship",
              desc: "Funding and mentorship for startups.",
            },
            {
              id: "wp-3",
              title: "🌟 Leadership",
              desc: "Workshops for confident leadership.",
            },
          ],
        },
      },

      // CTA — dark rose band with centered copy + button
      {
        id: "women-cta-join",
        type: "cta",
        data: {
          anchorId: "join",
          headline: "Join the Movement",
          subhead:
            "Together, we can create lasting impact and equality.",
          ctaLabel: "Get Involved",
          ctaHref: "#",
          theme: "dark",
          background: { color: "rose-600" },
          textColor: "white",
          align: "center",
          padding: "py-20",
        },
      },
    ],
  };
}

/* ============================================================================
   Evergreen Webinar – canonical starter schema for the "Run an evergreen
   webinar" goal in the Create Funnel modal. Previously this goal had
   nothing behind it at all — selecting it just gated the Create button,
   the funnel it created was always blank (see src/Bible/funnel-builder/gotchas.md).
   "Evergreen" = pre-recorded but presented as available on-demand any
   time, not a scheduled live event — hence no date/countdown content
   here, just "watch now."
============================================================================ */
export function getWebinarSchema() {
  return {
    blocks: [
      {
        id: "webinar-hero",
        type: "hero",
        data: {
          headline: "The Free Training That's Helping Creators Grow Faster",
          subhead:
            "Watch instantly — no waiting for a live time slot. Learn the exact system creators use to turn viewers into a loyal, paying audience.",
          actionType: "subscribe",
          ctaLabel: "Save My Seat — It's Free",
          image: "https://images.unsplash.com/photo-1758874384555-de68b8035c24?q=80&w=1600&auto=format&fit=crop",
          align: "center",
          gradientOverlay: true,
          gradientColor: "indigo-900/70",
          textColor: "white",
        },
      },
      {
        id: "webinar-heading",
        type: "heading",
        data: { text: "What You'll Learn Inside", size: 36, align: "center" },
      },
      {
        id: "webinar-features",
        type: "features",
        data: {
          title: "In this free training, you'll discover:",
          items: [
            { id: uuidv4(), title: "The 3-part content system", desc: "How top creators plan content that actually converts, without burning out." },
            { id: uuidv4(), title: "The subscriber-to-superfan pipeline", desc: "A simple way to turn one-time viewers into people who buy from you again and again." },
            { id: uuidv4(), title: "The tools that do the heavy lifting", desc: "Exactly what to use to automate the boring parts, so you can focus on creating." },
          ],
        },
      },
      {
        id: "webinar-paragraph",
        type: "paragraph",
        data: {
          text: "This training is available on-demand — watch whenever it suits you, from any device. No pressure, no hard sell, just the strategy.",
          width: 700,
          align: "center",
        },
      },
      {
        id: "webinar-cta",
        type: "cta",
        data: {
          headline: "Ready to watch?",
          subhead: "Join the creators already using this system to grow.",
          ctaLabel: "Save My Seat",
          actionType: "subscribe",
          theme: "dark",
          background: { color: "indigo-600" },
          align: "center",
        },
      },
    ],
  };
}

