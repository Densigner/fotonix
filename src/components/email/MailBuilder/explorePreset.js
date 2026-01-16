export const exploreBlocks = [
  // ── HEADER AREA (grey band) ──────────────────────────────────────────────
  {
    id: "section_header",
    type: "section",
    data: {
      background: "#9f9b9b",
      padding: { top: 20, right: 0, bottom: 24, left: 0 },
      align: "center"
    },
    children: [
      {
        id: "logo_top",
        type: "logo",
        data: {
          src: "https://gallery.eousercontent.com/0c035aee-9b79-11f0-a20d-2b34ffa5e2ed%2F1759387962194-Screenshot%202025-09-01%20120152.png",
          width: 160,
          href: "https://example.com"
        }
      },
      {
        id: "title_explore",
        type: "title",
        data: { text: "The explore template", align: "center", color: "#FFFFFF" }
      },
      {
        id: "text_kicker1",
        type: "text",
        data: {
          html: "Ideal for news or for displaying multiple products.<br/>Looks great on all screen sizes.",
          align: "center",
          color: "#FFFFFF"
        }
      }
    ]
  },

  // ── HERO IMAGE + INTRO COPY + CTA (on white) ────────────────────────────
  {
    id: "image_hero",
    type: "image",
    data: {
      src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
      alt: "Hero image",
      fullWidth: true
    }
  },
  {
    id: "text_intro",
    type: "text",
    data: {
      html:
        "Dummy text. Lorem ipsum dolor sit amet, consectetur adipiscing. Donec lacinia mi vitae lectus fringilla pellentesque.",
      align: "center",
      color: "#313638"
    }
  },
  {
    id: "button_primary_top",
    type: "button",
    data: {
      label: "Call to action",
      href: "#",
      align: "center",
      fill: "solid",
      background: "#FFFFFF",
      color: "#000000",
      width: "auto",
      padding: "12px 18px",
      borderRadius: 4
    }
  },

  // ── GRID (2 columns x 2 rows) ───────────────────────────────────────────
  {
    id: "grid_row_1",
    type: "columns",
    data: { columns: 2, gutter: 16, stackOnMobile: true, background: "#ffffff", padding: 16 },
    children: [
      {
        id: "col1_row1",
        type: "column",
        children: [
          {
            id: "img_c11",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "", width: "100%"
            }
          },
          { id: "h_c11", type: "title", data: { text: "Heading", align: "left", size: 18 } },
          {
            id: "t_c11",
            type: "text",
            data: {
              html: "Use this spot to share any secondary blog posts you may have written",
              align: "left"
            }
          }
        ]
      },
      {
        id: "col2_row1",
        type: "column",
        children: [
          {
            id: "img_c12",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "", width: "100%"
            }
          },
          { id: "h_c12", type: "title", data: { text: "Heading", align: "left", size: 18 } },
          {
            id: "t_c12",
            type: "text",
            data: {
              html: "Use this spot to share any secondary blog posts you may have written",
              align: "left"
            }
          }
        ]
      }
    ]
  },

  {
    id: "grid_row_2",
    type: "columns",
    data: { columns: 2, gutter: 16, stackOnMobile: true, background: "#ffffff", padding: 16 },
    children: [
      {
        id: "col1_row2",
        type: "column",
        children: [
          {
            id: "img_c21",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "", width: "100%"
            }
          },
          { id: "h_c21", type: "title", data: { text: "Heading", align: "left", size: 18 } },
          {
            id: "t_c21",
            type: "text",
            data: {
              html: "Use this spot to share any secondary blog posts you may have written",
              align: "left"
            }
          }
        ]
      },
      {
        id: "col2_row2",
        type: "column",
        children: [
          {
            id: "img_c22",
            type: "image",
            data: {
              src: "https://gallery.eomail1.com/tentacles/placeholders/image.png",
              alt: "", width: "100%"
            }
          },
          { id: "h_c22", type: "title", data: { text: "Heading", align: "left", size: 18 } },
          {
            id: "t_c22",
            type: "text",
            data: {
              html: "Use this spot to share any secondary blog posts you may have written",
              align: "left"
            }
          }
        ]
      }
    ]
  },

  // ── CTA (center) ────────────────────────────────────────────────────────
  {
    id: "button_primary_bottom",
    type: "button",
    data: {
      label: "Call to action",
      href: "#",
      align: "center",
      fill: "solid",
      background: "#FFFFFF",
      color: "#000000",
      width: "auto",
      padding: "12px 18px",
      borderRadius: 4
    }
  },

  // ── FOOTER (light grey) ─────────────────────────────────────────────────
  {
    id: "section_footer",
    type: "section",
    data: {
      background: "#efefef",
      padding: { top: 18, right: 0, bottom: 18, left: 0 },
      align: "center"
    },
    children: [
      {
        id: "social_fb",
        type: "social-follow",
        data: {
          links: [
            {
              name: "facebook",
              href: "https://www.facebook.com/realfotonix?locale=en_GB",
              icon:
                "https://gallery.eousercontent.com/tentacles/icons/v1/social-block/square/color/facebook.png",
              size: 48
            }
          ]
        }
      },
      {
        id: "text_legal",
        type: "text",
        data: {
          html:
            'You received this email because you subscribed to our list. You can <a href="{{UnsubscribeURL}}" target="_blank" rel="noopener">unsubscribe</a> at any time.<br><br>{{SenderInfo}}',
          align: "center",
          size: 12,
          color: "#313638"
        }
      },
      {
        id: "powered_badge",
        type: "image",
        data: {
          src:
            "https://eogallery1.com/8324eba2-72c3-11ea-a3d0-06b4694bee2a%2F1586536266496-bottom-badge.png",
          alt: "Powered by EmailOctopus",
          width: 150,
          href: "{{RewardsURL}}"
        }
      }
    ]
  }
];
