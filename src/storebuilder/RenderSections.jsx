import React from "react";
import { registry } from "../storebuilder/registry";

export default function RenderSections({ sections, products }) {
  if (!sections || !sections.length) return null;
  return (
    <div className="space-y-8">
      {sections.map((s) => {
        const plugin = registry.get(s.type) || registry.get(s.type);
        const R = plugin?.Render;
        if (!R) return null;
        return <R key={s.id} section={s} products={products} />;
      })}
    </div>
  );
}
