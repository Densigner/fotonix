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
            image: 'https://images.unsplash.com/photo-1523246126-450c01b3a643?q=80&w=1600&auto=format&fit=crop',
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
          background: "/templates/volunhero.png",
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
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
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
            "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3c?q=80&w=1600&auto=format&fit=crop",
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

