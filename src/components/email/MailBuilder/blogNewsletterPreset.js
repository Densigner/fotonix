export const blogNewsletterBlocks = [
  // ── HERO IMAGE ───────────────────────────────────────────────────────────
  {
    id: "hero",
    type: "image",
    data: {
      src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
      alt: "Primary article image",
      fullWidth: true,
      height: 220,
      background: "#e9eef4"
    }
  },

  // ── TITLE + SUBTITLE ────────────────────────────────────────────────────
  {
    id: "title_primary",
    type: "title",
    data: { text: "Primary article position", align: "center", size: 22 }
  },
  {
    id: "subtitle",
    type: "text",
    data: {
      html: "This template is a great starter point for your blog newsletter",
      align: "center",
      color: "#313638"
    }
  },

  // ── PRIMARY CTA ─────────────────────────────────────────────────────────
  {
    id: "cta_primary",
    type: "button",
    data: {
      label: "Call to action",
      href: "#",
      align: "center",
      fill: "ghost",
      background: "#FFFFFF",
      color: "#000000",
      padding: "10px 16px",
      borderRadius: 3
    }
  },

  // ── SECOND ARTICLE (image left, copy right) ─────────────────────────────
  {
    id: "row_second",
    type: "columns",
    data: { columns: 2, gutter: 16, stackOnMobile: true, padding: 0 },
    children: [
      {
        id: "col_img_second",
        type: "column",
        width: "40%",
        children: [
          {
            id: "img_second",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "",
              width: "100%",
              height: 110,
              background: "#eef2f7"
            }
          }
        ]
      },
      {
        id: "col_copy_second",
        type: "column",
        width: "60%",
        children: [
          {
            id: "h_second",
            type: "title",
            data: { text: "Your second blog post", align: "left", size: 16 }
          },
          {
            id: "t_second",
            type: "text",
            data: {
              html:
                "Use this spot to share any secondary blog posts you may have written",
              align: "left"
            }
          },
          {
            id: "cta_second",
            type: "button",
            data: {
              label: "Call to action",
              href: "#",
              align: "left",
              fill: "ghost",
              background: "#FFFFFF",
              color: "#000000",
              padding: "8px 12px",
              borderRadius: 3
            }
          }
        ]
      }
    ]
  },

  // ── THIRD ARTICLE (image left, copy right) ──────────────────────────────
  {
    id: "row_third",
    type: "columns",
    data: { columns: 2, gutter: 16, stackOnMobile: true, padding: 0 },
    children: [
      {
        id: "col_img_third",
        type: "column",
        width: "40%",
        children: [
          {
            id: "img_third",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "",
              width: "100%",
              height: 110,
              background: "#eef2f7"
            }
          }
        ]
      },
      {
        id: "col_copy_third",
        type: "column",
        width: "60%",
        children: [
          {
            id: "h_third",
            type: "title",
            data: { text: "Your third blog post", align: "left", size: 16 }
          },
          {
            id: "t_third",
            type: "text",
            data: {
              html:
                "Use this spot to share any secondary blog posts you may have written",
              align: "left"
            }
          },
          {
            id: "cta_third",
            type: "button",
            data: {
              label: "Call to action",
              href: "#",
              align: "left",
              fill: "ghost",
              background: "#FFFFFF",
              color: "#000000",
              padding: "8px 12px",
              borderRadius: 3
            }
          }
        ]
      }
    ]
  }
];
