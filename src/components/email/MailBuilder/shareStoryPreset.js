export const shareStoryBlocks = [
  // ── TITLE ────────────────────────────────────────────────────────────────
  {
    id: "title_share",
    type: "title",
    data: {
      text: "Share your story",
      align: "center",
      size: 28
    }
  },

  // ── HERO IMAGE ───────────────────────────────────────────────────────────
  {
    id: "hero_image",
    type: "image",
    data: {
      src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
      alt: "Hero",
      fullWidth: true,
      border: { width: 1, color: "#cdd5ea" }, // faint frame like screenshot
      margin: { top: 12, bottom: 12 }
    }
  },

  // ── SECONDARY IMAGES (2 COLUMNS) ────────────────────────────────────────
  {
    id: "row_secondary",
    type: "columns",
    data: { columns: 2, gutter: 12, stackOnMobile: true, padding: 0 },
    children: [
      {
        id: "col_left",
        type: "column",
        children: [
          {
            id: "img_left",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "Secondary image",
              width: "100%",
              background: "#eef2f7",
              height: 120
            }
          }
        ]
      },
      {
        id: "col_right",
        type: "column",
        children: [
          {
            id: "img_right",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "Secondary image",
              width: "100%",
              background: "#eef2f7",
              height: 120
            }
          }
        ]
      }
    ]
  },

  // ── BODY COPY (TWO PARAGRAPHS) ──────────────────────────────────────────
  {
    id: "body_para_1",
    type: "text",
    data: {
      html:
        "This template is great for sharing the latest products or news you may have. This text section can expand to be as long as you need and the call to action ensures you’ll be sending traffic wherever it’s needed.",
      align: "left",
      color: "#313638"
    }
  },
  {
    id: "body_para_2",
    type: "text",
    data: {
      html:
        "The large hero section will catch the attention of your readers and the two secondary image locations can be used for additional product or location shots.",
      align: "left",
      color: "#313638"
    }
  },

  // ── CTA ─────────────────────────────────────────────────────────────────
  {
    id: "cta",
    type: "button",
    data: {
      label: "Call to action",
      href: "#",
      align: "center",
      fill: "ghost",
      background: "#FFFFFF",
      color: "#000000",
      padding: "12px 18px",
      borderRadius: 4
    }
  }
];
