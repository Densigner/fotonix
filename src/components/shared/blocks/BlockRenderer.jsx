import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDrag, useDrop } from 'react-dnd';
import { createBlock } from '../../../lib/blockModel';
import TextEditor from '../../TextEditor';
import AssetManager from '../AssetManager';

const PALETTE_TYPE = 'BLOCK_PALETTE_ITEM';
const BLOCK_TYPE = 'BLOCK';

/**
 * BlockRenderer
 * Props:
 * - block
 * - onSelect(blockId)
 * - onUpdate(blockId, partialUpdate)
 * - onDelete(blockId)
 */
export default function BlockRenderer({ block, onSelect, onUpdate, onDelete, onMove, previewMode = false }) {
  const [hovered, setHovered] = useState(false);
  const [showAsset, setShowAsset] = useState(false);
  const ref = useRef(null);

  // Make the whole block draggable for reordering
  const [{ isDragging }, drag] = useDrag(() => ({
    type: BLOCK_TYPE,
    item: { id: block.id },
    collect: (m) => ({ isDragging: !!m.isDragging() }),
  }), [block.id]);

  // For block-level drop (no-op here)
  const [, drop] = useDrop(() => ({ accept: [], drop: () => undefined }), [block]);

  drag(drop(ref));

  const onContentChange = useCallback((next) => {
    if (next !== block.meta.content) {
      onUpdate(block.id, { meta: Object.assign({}, block.meta, { content: next }) });
    }
  }, [block, onUpdate]);

  // Image picker hidden input
  const fileInputRef = useRef(null);
  const handleImageClick = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);
  const handleFileChange = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    onUpdate(block.id, { meta: Object.assign({}, block.meta, { src: url }) });
  }, [block, onUpdate]);

  // Duplicate helper - signal parent via special metadata flag
  const handleDuplicate = useCallback(() => {
    onUpdate(block.id, { __duplicate: true });
  }, [block, onUpdate]);

  // Inline editors
  function renderText() {
    return (
      <div className={`p-3 ${isDragging ? 'opacity-50' : ''}`}>
        <div onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}>
          <TextEditor
            content={block.meta && block.meta.content}
            onChange={(html) => onUpdate(block.id, { meta: Object.assign({}, block.meta, { content: html }) })}
            readOnly={previewMode}
            styles={block.styles}
          />
        </div>
      </div>
    );
  }

  function renderImage() {
    return (
      <div className="p-3" onClick={() => onSelect(block.id)}>
        <img src={block.meta && block.meta.src} alt={block.meta && block.meta.alt} style={{ width: '100%', height: block.meta && block.meta.height ? block.meta.height : 'auto', objectFit: (block.meta && block.meta.fit) || 'contain' }} onClick={() => setShowAsset(true)} />
        <div className="mt-2 flex gap-2">
          <button className="px-2 py-1 bg-slate-700 rounded text-white" onClick={(e) => { e.stopPropagation(); setShowAsset(true); }}>Replace</button>
        </div>
        <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
      </div>
    );
  }

  // handle asset selection callback
  const handleAssetSelect = useCallback((url, dims) => {
    const meta = Object.assign({}, block.meta, { src: url });
    if (dims && dims.width) meta.width = dims.width;
    if (dims && dims.height) meta.height = dims.height;
    onUpdate(block.id, { meta });
    setShowAsset(false);
  }, [block, onUpdate]);

  function renderButton() {
    const style = block.meta && block.meta.style ? block.meta.style : {};
    const variant = style.variant === 'primary' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-100';
    const size = style.size === 'lg' ? 'px-4 py-2' : 'px-3 py-1 text-sm';
    return (
      <div className="p-3">
        <a href={block.meta && block.meta.url} className={`inline-block rounded ${variant} ${size}`} onClick={(e) => { e.stopPropagation(); }}>
          {block.meta && block.meta.label}
        </a>
      </div>
    );
  }

  function renderDivider() {
    const thickness = (block.meta && (block.meta.thickness || block.meta.height)) || 1;
    const color = (block.meta && block.meta.color) || '#e6e6e6';
    const dashed = !!(block.meta && block.meta.dashed);
    return (
      <div className="p-3">
        <div style={{ height: thickness, background: color, borderTop: dashed ? `1px dashed ${color}` : 'none' }} />
      </div>
    );
  }

  // Column drop zone for each column
  function Column({ colIndex }) {
    const colBlocks = (block.meta && block.meta.blocks && block.meta.blocks[colIndex]) || [];
    const [, colDrop] = useDrop(() => ({
      accept: [PALETTE_TYPE, BLOCK_TYPE],
      drop: (item, monitor) => {
        if (monitor.getItemType() === PALETTE_TYPE) {
          const nb = createBlock(item.type);
          const nextMeta = Object.assign({}, block.meta, { blocks: (block.meta && block.meta.blocks) ? block.meta.blocks.map((c, idx) => idx === colIndex ? [...c, nb] : c) : [[...colBlocks, nb]] });
          onUpdate(block.id, { meta: nextMeta });
          return;
        }
        if (monitor.getItemType() === BLOCK_TYPE) {
          // existing block moved into this column
          if (onMove) onMove(item.id, { type: 'column', columnBlockId: block.id, colIndex, insertIndex: null });
        }
      }
    }), [block, colIndex, onMove]);

    return (
      <div ref={colDrop} className="flex-1 p-2 border border-white/6 min-h-[60px]">
        {colBlocks.map((b) => (
          // Render nested block - assume parent provides handlers that can reach nested blocks by id
          <BlockRenderer key={b.id} block={b} onSelect={onSelect} onUpdate={(id, patch) => {
            // patch nested block in-place
            const nextBlocks = (block.meta && block.meta.blocks) ? block.meta.blocks.map((c, idx) => idx === colIndex ? c.map(nb => nb.id === id ? Object.assign({}, nb, patch) : nb) : c) : [];
            const nextMeta = Object.assign({}, block.meta, { blocks: nextBlocks });
            onUpdate(block.id, { meta: nextMeta });
          }} onDelete={(id) => {
            const nextBlocks = (block.meta && block.meta.blocks) ? block.meta.blocks.map((c, idx) => idx === colIndex ? c.filter(nb => nb.id !== id) : c) : [];
            const nextMeta = Object.assign({}, block.meta, { blocks: nextBlocks });
            onUpdate(block.id, { meta: nextMeta });
          }} />
        ))}
      </div>
    );
  }

  function renderColumns() {
    const cols = (block.meta && block.meta.columns) || 2;
    const widths = (block.meta && block.meta.widths) || null; // array of percentages
    const gutter = (block.meta && block.meta.gutter) || 16;

    // mobile stacking handled by previewMode prop
    if (previewMode === 'preview-mobile') {
      return (
        <div className="p-3 flex flex-col gap-3">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="w-full">
              <Column colIndex={i} />
            </div>
          ))}
        </div>
      );
    }

    // desktop/editor: flexible columns, resizable via handles
    const totalGutter = gutter * (cols - 1);
    return (
      <div className="p-3 flex gap-0 items-start" style={{ columnGap: gutter }}>
        <ColumnsResizerContainer block={block} cols={cols} widths={widths} gutter={gutter} onUpdate={onUpdate}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ flexBasis: widths && widths[i] ? `${widths[i]}%` : `${100 / cols}%`, flexGrow: 0, flexShrink: 0, paddingLeft: i === 0 ? 0 : 0 }}>
              <Column colIndex={i} />
            </div>
          ))}
        </ColumnsResizerContainer>
      </div>
    );
  }

  // Container component to provide resize handles and manage width state
  function ColumnsResizerContainer({ block, cols, widths, gutter, onUpdate, children }) {
    const containerRef = useRef(null);
    const draggingRef = useRef(null);
    const [localWidths, setLocalWidths] = useState(() => {
      if (widths && widths.length === cols) return widths.slice();
      const per = 100 / cols; return Array.from({ length: cols }).map(() => per);
    });

    useEffect(() => {
      // sync when meta changes externally
      if (widths && widths.length === cols) setLocalWidths(widths.slice());
    }, [widths, cols]);

    function startDrag(i, e) {
      e.preventDefault();
      draggingRef.current = { index: i, startX: e.clientX, startWidths: localWidths.slice() };
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', endDrag);
    }

    function onDrag(e) {
      const d = draggingRef.current;
      if (!d) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaPx = e.clientX - d.startX;
      const deltaPct = (deltaPx / rect.width) * 100;
      const i = d.index;
      const next = d.startWidths.slice();
      // move between i and i+1
      const min = 20; const max = 80;
      next[i] = Math.max(min, Math.min(max, d.startWidths[i] + deltaPct));
      next[i + 1] = Math.max(min, Math.min(max, d.startWidths[i + 1] - deltaPct));
      // if adjustment breaks total (due to clamping), normalize among neighbors
      const sum = next.reduce((s, x) => s + x, 0);
      const norm = next.map(x => (x / sum) * 100);
      setLocalWidths(norm);
    }

    function endDrag() {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
      draggingRef.current = null;
      // persist widths in meta
      onUpdate(block.id, { meta: Object.assign({}, block.meta, { widths: localWidths }) });
    }

    return (
      <div ref={containerRef} className="w-full relative flex" style={{ gap: gutter }}>
        {children.map((child, idx) => (
          <React.Fragment key={idx}>
            {child}
            {idx < cols - 1 && (
              <div
                onMouseDown={(e) => startDrag(idx, e)}
                style={{ width: 8, cursor: 'col-resize', marginLeft: 6, marginRight: 6 }}
                className="bg-white/6 hover:bg-sky-500 rounded"
                aria-hidden
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  function renderSpacer() {
    const height = (block.meta && block.meta.height) || 16;
    const refHandle = useRef(null);
    const containerRef = useRef(null);
    // Drag handlers to adjust height live
    useEffect(() => {
      let dragging = false;
      let startY = 0;
      let startH = height;
      function onMouseDown(e) {
        if (e.target === refHandle.current) {
          e.preventDefault();
          dragging = true;
          startY = e.clientY;
          startH = (block.meta && block.meta.height) || height;
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onEnd);
        }
      }
      function onMove(e) {
        if (!dragging) return;
        const delta = e.clientY - startY;
        const next = Math.max(0, Math.min(200, startH + delta));
        onUpdate(block.id, { meta: Object.assign({}, block.meta, { height: Math.round(next) }) });
      }
      function onEnd() {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        // persisted already via onUpdate during drag; nothing else needed
      }
      const el = containerRef.current;
      if (el) el.addEventListener('mousedown', onMouseDown);
      return () => {
        if (el) el.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
      };
    }, [block, height, onUpdate]);

    return (
      <div ref={containerRef} className="relative">
        <div style={{ height }} />
        <div ref={refHandle} style={{ height: 8, cursor: 'ns-resize', position: 'absolute', left: 0, right: 0, bottom: 0 }} className="bg-white/10 hover:bg-sky-500" title="Drag to resize spacer" />
      </div>
    );
  }

  // toolbar
  const toolbar = (
    <div className={`absolute right-2 top-2 z-10 flex gap-2 ${hovered || false ? '' : 'opacity-0 group-hover:opacity-100'}`}>
      <button title="Duplicate" onClick={(e) => { e.stopPropagation(); handleDuplicate(); }} className="p-1 bg-white/6 rounded">⎘</button>
      <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(block.id); }} className="p-1 bg-red-600 rounded">✕</button>
    </div>
  );

  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => onSelect(block.id)} className={`relative mb-3 rounded ${hovered ? 'ring-2 ring-sky-500' : ''}`}>
      {toolbar}
      {block.type === 'text' && renderText()}
      {block.type === 'image' && renderImage()}
      {block.type === 'button' && renderButton()}
      {block.type === 'divider' && renderDivider()}
      {block.type === 'columns' && renderColumns()}
      {block.type === 'spacer' && renderSpacer()}
      {showAsset && (
        <AssetManager tid={'default'} onClose={() => setShowAsset(false)} onSelect={handleAssetSelect} />
      )}
    </div>
  );
}

BlockRenderer.propTypes = {
  block: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
