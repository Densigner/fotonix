import React from "react";
import {
  Type as TitleIcon,
  AlignLeft,
  Sparkles,
  Image as ImageIcon,
  Video,
  Hand as ButtonIcon,
  Share2,
  Minus,
  Code2,
} from "lucide-react";

const BLOCKS = [
  { id: "title", label: "Title", icon: <TitleIcon className="h-8 w-8" aria-hidden /> },
  { id: "text", label: "Text", icon: <AlignLeft className="h-8 w-8" aria-hidden /> },
  { id: "logo", label: "Logo", icon: <Sparkles className="h-8 w-8" aria-hidden /> },
  { id: "image", label: "Image", icon: <ImageIcon className="h-8 w-8" aria-hidden /> },
  { id: "video", label: "Video", icon: <Video className="h-8 w-8" aria-hidden /> },
  { id: "button", label: "Button", icon: <ButtonIcon className="h-8 w-8" aria-hidden /> },
  { id: "social-follow", label: "Social follow", icon: <Share2 className="h-8 w-8" aria-hidden /> },
  { id: "divider", label: "Divider", icon: <Minus className="h-8 w-8" aria-hidden /> },
  { id: "code", label: "Code", icon: <Code2 className="h-8 w-8" aria-hidden /> },
];

function BlockCard({ id, label, icon, onInsert }) {
  const handleDragStart = (e) => {
    try {
      e.dataTransfer.setData(
        "application/x-editor-block",
        JSON.stringify({ type: id })
      );
      e.dataTransfer.effectAllowed = "copyMove";
    } catch (err) {
      // ignore
    }
  };

  return (
    <button
      type="button"
      className="group relative flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-grab active:cursor-grabbing"
      onClick={() => onInsert?.(id)}
      draggable
      onDragStart={handleDragStart}
      aria-label={label}
    >
      <div className="mb-3 opacity-70 group-hover:opacity-100">{icon}</div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </button>
  );
}

export default function EditorSidebarBlocks({ onInsert, className }) {
  return (
    <div className={`grid grid-cols-3 gap-3 p-3 ${className || ""}`}>
      {BLOCKS.map((b) => (
        <BlockCard key={b.id} id={b.id} label={b.label} icon={b.icon} onInsert={onInsert} />
      ))}
    </div>
  );
}
