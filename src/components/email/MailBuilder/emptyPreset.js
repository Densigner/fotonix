// Empty email template preset - minimal starting point
export const emptyBlocks = [
  {
    id: "empty_text_1",
    type: "text",
    data: {
      html: "Start writing your email content here...",
      align: "left",
      fontSize: 16,
      color: "#333333"
    }
  }
];

// Optional: Export as complete template object with metadata
export const emptyTemplate = {
  id: "empty",
  name: "Empty Template", 
  description: "A blank template to start from scratch",
  screenshotUrl: "/images/hero/empty.png",
  blocks: emptyBlocks,
  metadata: {
    category: "basic",
    difficulty: "beginner",
    estimatedTime: "5 minutes"
  }
};