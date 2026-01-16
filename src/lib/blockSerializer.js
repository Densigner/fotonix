// Minimal serializer / parser to convert block model <-> HTML
// Serializer embeds data-block-type attributes to enable a best-effort round-trip

export function serializeBlocksToHtml(blocks = [], options = {}) {
  const brand = options.brand || {};
  // simple CSS using CSS variables for brand values
  const style = `:root{ --brand-primary:${brand.primaryColor || '#0ea5a4'}; --brand-accent:${brand.accentColor || '#06b6d4'}; --brand-secondary:${brand.secondaryColor || '#64748b'}; --base-font:${brand.defaultFontFamily || 'Arial, system-ui, -apple-system'}; --base-font-size:${brand.baseFontSize || 16}px; --body-bg:${brand.bodyBackground || '#ffffff'} } body{background:var(--body-bg); font-family:var(--base-font); font-size:var(--base-font-size);} .btn{background:var(--brand-primary); color:#fff; padding:8px 12px; border-radius:4px; text-decoration:none; display:inline-block;}
  `;

  function renderBlock(b) {
    const mt = b.meta || {};
    const styles = b.styles || {};
    if (b.type === 'text') {
      const fontSize = styles.fontSize ? `font-size:${styles.fontSize}px;` : '';
      const color = styles.color ? `color:${styles.color};` : '';
      return `<div data-block-type="text" data-block-id="${b.id}" style="${fontSize}${color}">${mt.content || ''}</div>`;
    }
    if (b.type === 'image') {
      return `<img data-block-type="image" data-block-id="${b.id}" src="${mt.src || ''}" alt="${mt.alt || ''}" style="max-width:100%;height:auto;"/>`;
    }
    if (b.type === 'button') {
      return `<a data-block-type="button" data-block-id="${b.id}" href="${mt.url || '#'}" class="btn">${mt.label || 'Button'}</a>`;
    }
    if (b.type === 'divider') {
      const thickness = mt.thickness || mt.height || 1;
      const color = mt.color || '#e6e6e6';
      const dashed = mt.dashed ? 'border-top:1px dashed ' + color + ';' : '';
      return `<div data-block-type="divider" data-block-id="${b.id}" style="height:${thickness}px;background:${color};${dashed}"></div>`;
    }
    if (b.type === 'spacer') {
      const h = mt.height || 16;
      return `<div data-block-type="spacer" data-block-id="${b.id}" style="height:${h}px"></div>`;
    }
    if (b.type === 'columns') {
      const cols = mt.columns || 2;
      const widths = mt.widths || Array.from({ length: cols }).map(() => 100 / cols);
      const gutter = mt.gutter || 16;
      const inner = (mt.blocks || []).map((col, idx) => {
        const colHtml = (col || []).map(cb => renderBlock(cb)).join('');
        return `<div data-block-type="column" data-col-index="${idx}" style="flex-basis:${widths[idx]}%">${colHtml}</div>`;
      }).join('');
      return `<div data-block-type="columns" data-block-id="${b.id}" style="display:flex;gap:${gutter}px">${inner}</div>`;
    }
    // fallback: output JSON
    return `<pre data-block-type="unknown" data-block-id="${b.id}">${JSON.stringify(b)}</pre>`;
  }

  const body = blocks.map(b => renderBlock(b)).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body>${body}</body></html>`;
}

// parseHtmlToBlocks: best-effort parser that looks for data-block-type attributes
export function parseHtmlToBlocks(html) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // parsing is intended for client-side usage
    throw new Error('parseHtmlToBlocks requires a browser DOMParser');
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const blocks = [];
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') continue;
    const el = node.nodeType === Node.TEXT_NODE ? null : node;
    if (!el) continue;
    const t = el.getAttribute('data-block-type');
    const id = el.getAttribute('data-block-id') || null;
    if (t === 'text') {
      blocks.push({ id: id || null, type: 'text', meta: { content: el.innerHTML }, styles: { fontSize: parseInt(el.style.fontSize) || undefined, color: el.style.color || undefined } });
      continue;
    }
    if (t === 'image') {
      blocks.push({ id: id || null, type: 'image', meta: { src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' } });
      continue;
    }
    if (t === 'button') {
      blocks.push({ id: id || null, type: 'button', meta: { label: el.textContent || 'Button', url: el.getAttribute('href') || '#' } });
      continue;
    }
    if (t === 'divider') {
      const height = parseInt(el.style.height) || 1;
      const color = el.style.background || undefined;
      const dashed = (el.style.borderTop || '').includes('dashed');
      blocks.push({ id: id || null, type: 'divider', meta: { height, color, dashed } });
      continue;
    }
    if (t === 'spacer') {
      const height = parseInt(el.style.height) || 16;
      blocks.push({ id: id || null, type: 'spacer', meta: { height } });
      continue;
    }
    if (t === 'columns') {
      const colEls = Array.from(el.querySelectorAll('[data-block-type="column"]'));
      const blocksPerCol = colEls.map(colEl => {
        const children = Array.from(colEl.childNodes).map(ch => ch.nodeType === Node.ELEMENT_NODE ? ch : null).filter(Boolean);
        return children.map(child => {
          const ct = child.getAttribute('data-block-type');
          const cid = child.getAttribute('data-block-id') || null;
          if (ct === 'text') return { id: cid, type: 'text', meta: { content: child.innerHTML } };
          if (ct === 'image') return { id: cid, type: 'image', meta: { src: child.getAttribute('src') || '' } };
          if (ct === 'button') return { id: cid, type: 'button', meta: { label: child.textContent || 'Button', url: child.getAttribute('href') || '#' } };
          return { id: cid, type: 'text', meta: { content: child.outerHTML } };
        });
      });
      blocks.push({ id: id || null, type: 'columns', meta: { columns: colEls.length, blocks: blocksPerCol } });
      continue;
    }
    // unknown => try to interpret as text
    blocks.push({ id: id || null, type: 'text', meta: { content: el.outerHTML } });
  }
  return blocks;
}
