// Minimal IDs; your editor just needs unique strings.
export const birthdayBlocks = [
  {
    id: "logo_1",
    type: "logo",
    data: {
      src: "https://gallery.eousercontent.com/0c035aee-9b79-11f0-a20d-2b34ffa5e2ed%2F1759387962194-Screenshot%202025-09-01%20120152.png",
      href: "https://example.com",
      width: 160
    }
  },
  {
    id: "title_letscelebrate",
    type: "title",
    data: { text: "Let’s celebrate!", align: "left" }
  },
  {
    id: "text_greeting",
    type: "text",
    data: { html: "Happy Birthday {{FirstName}}!" }
  },
  {
    id: "text_para1",
    type: "text",
    data: {
      html:
        "We hope you get to spend the day doing the things you enjoy most, whether that’s celebrating with friends, indulging in some cake, or just taking it easy."
    }
  },
  {
    id: "text_para2",
    type: "text",
    data: {
      html:
        "To make the day a little brighter, we’ve got something special waiting for you!"
    }
  },
  {
    id: "button_cta",
    type: "button",
    data: { label: "Collect your birthday offer", href: "#" }
  },
  {
    id: "text_mkt1",
    type: "text",
    data: {
      html:
        "Birthday emails are one of the most effective ways to add a personal touch to your marketing. They show subscribers you value them as individuals, not just as part of your list."
    }
  },
  {
    id: "text_mkt2",
    type: "text",
    data: {
      html:
        "Including a time-limited offer, like in this template, also encourages quick action. They'll just need to click the button above to claim it!"
    }
  },
  {
    id: "social_fb",
    type: "social-follow",
    data: {
      links: [
        {
          name: "facebook",
          href: "https://www.facebook.com/realfotonix?locale=en_GB",
          icon:
            "https://gallery.eousercontent.com/tentacles/icons/v1/social-block/square/color/facebook.png"
        }
      ]
    }
  }
];
