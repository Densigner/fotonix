export const welcomeBlocks = [
  // ── HEADING ─────────────────────────────────────────────────────────────
  {
    id: "title_welcome",
    type: "title",
    data: {
      text: "Welcome aboard",
      align: "center",
      size: 24
    }
  },

  // ── HERO IMAGE ─────────────────────────────────────────────────────────
  {
    id: "hero_img",
    type: "image",
    data: {
      src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
      alt: "Hero",
      fullWidth: true,
      height: 200,
      background: "#e9eef4"
    }
  },

  // ── INTRO PARAGRAPHS ───────────────────────────────────────────────────
  {
    id: "intro_1",
    type: "text",
    data: {
      html: "Designed to welcome your customers to your list.",
      align: "left"
    }
  },
  {
    id: "intro_2",
    type: "text",
    data: {
      html:
        "When paired with a simple automation, you can take the first step towards building stronger connections with your audience. From sharing updates and telling your story, to growing your community and boosting your business, everything starts with this first “hello.”",
      align: "left"
    }
  },
  {
    id: "intro_3",
    type: "text",
    data: {
      html:
        "Think of it as the beginning of a conversation that will keep your subscribers engaged and coming back for more.",
      align: "left"
    }
  },

  // ── SUBHEADING ─────────────────────────────────────────────────────────
  {
    id: "title_sub",
    type: "title",
    data: {
      text: "Why you’re in the right place",
      align: "center",
      size: 20
    }
  },

  // ── THREE FEATURE COLUMNS ──────────────────────────────────────────────
  {
    id: "features",
    type: "columns",
    data: { columns: 3, gutter: 12, stackOnMobile: true },
    children: [
      {
        id: "col1",
        type: "column",
        children: [
          {
            id: "img1",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "",
              width: "100%",
              height: 80,
              background: "#eef2f7"
            }
          },
          {
            id: "h1",
            type: "title",
            data: { text: "Stay in the loop", align: "center", size: 16 }
          },
          {
            id: "t1",
            type: "text",
            data: {
              html: "Get the latest updates, tips and stories delivered straight to your inbox.",
              align: "center"
            }
          }
        ]
      },
      {
        id: "col2",
        type: "column",
        children: [
          {
            id: "img2",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "",
              width: "100%",
              height: 80,
              background: "#eef2f7"
            }
          },
          {
            id: "h2",
            type: "title",
            data: { text: "Exclusive perks", align: "center", size: 16 }
          },
          {
            id: "t2",
            type: "text",
            data: {
              html: "From special offers to first looks, you’ll be the first to know.",
              align: "center"
            }
          }
        ]
      },
      {
        id: "col3",
        type: "column",
        children: [
          {
            id: "img3",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "",
              width: "100%",
              height: 80,
              background: "#eef2f7"
            }
          },
          {
            id: "h3",
            type: "title",
            data: { text: "Made for you", align: "center", size: 16 }
          },
          {
            id: "t3",
            type: "text",
            data: {
              html: "We’ll keep things personal and relevant. Our emails are worth your time.",
              align: "center"
            }
          }
        ]
      }
    ]
  },

  // ── SIGN-OFF ───────────────────────────────────────────────────────────
  {
    id: "closing",
    type: "text",
    data: {
      html: "Welcome once again, we’re glad you’re here.<br/><br/>Speak soon!",
      align: "left"
    }
  }
];
