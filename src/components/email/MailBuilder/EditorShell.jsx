// BAD: setBlocks(blocks.map(...))  // uses closed-over snapshot
// GOOD: setBlocks(prev => prev.map(b => b.id === id ? { ...b, meta:{ ...b.meta, content: newValue } } : b));
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../../../config/environment';
import { createBlock, cloneBlock, serializeBlocks } from '../../../lib/blockModel';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

/**
 * EditorShell.jsx
 * - Left: palette of draggable block types
 * - Center: canvas with drop zones between blocks
 * - Right: inspector to edit selected block
 *
 * Props:
 *  - initialBlocks: array of blocks
 *  - onSave(blocks): function called on save
 */

const PALETTE_TYPE = 'BLOCK_PALETTE_ITEM';
const BLOCK_TYPE = 'BLOCK';

function PaletteItem({ type, label, onInsert }) {
  const [, drag] = useDrag(() => ({ type: PALETTE_TYPE, item: { type } }), [type]);
  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onInsert) onInsert(type);
    }
  }
  return (
    <div
      ref={drag}
      role="button"
      tabIndex={0}
      aria-label={`Insert ${label} block`}
      onKeyDown={handleKey}
      onClick={() => onInsert && onInsert(type)}
      className="p-2 mb-2 bg-white/5 rounded cursor-move focus:outline-2 focus:outline-sky-500"
    >
      {label}
    </div>
  );
}

function DropZone({ onDropAtIndex, index }) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: [PALETTE_TYPE, BLOCK_TYPE],
    collect: (monitor) => ({ isOver: !!monitor.isOver() }),
    drop: (item, monitor) => {
      // item.type present => palette item; otherwise existing block payload (BLOCK)
      if (monitor.getItemType() === PALETTE_TYPE) {
        return onDropAtIndex(item.type, index);
      }
      if (monitor.getItemType() === BLOCK_TYPE) {
        return onDropAtIndex({ draggedId: item.id, origin: item.origin }, index);
      }
    }
  }), [onDropAtIndex, index]);

  return (
    <div ref={drop} className={`h-4 transition-all duration-150 ${isOver ? 'bg-sky-600/40' : ''}`} />
  );
}

function BlockView({ block, isSelected, onSelect, onDelete }) {
  return (
    <div onClick={() => onSelect(block.id)} className={`p-3 mb-2 rounded border ${isSelected ? 'border-sky-500' : 'border-transparent'} bg-white/3`}>
      <div className="text-sm text-slate-200 font-medium">{block.type.toUpperCase()}</div>
      <div className="text-xs text-slate-400 mt-1">{JSON.stringify(block.meta)}</div>
      <div className="mt-2 text-right">
        <button className="px-2 py-1 text-xs bg-red-600 rounded" onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}>Delete</button>
      </div>
    </div>
  );
}

import { BrandProvider, useBrand } from './BrandContext';
import BrandSettingsPanel from './BrandSettingsPanel';
import PreviewPane from './PreviewPane';
import TemplateLibrary from './TemplateLibrary';
import ReactAce from 'react-ace';
import { serializeBlocksToHtml, parseHtmlToBlocks } from '../../../lib/blockSerializer';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-tomorrow';

function EditorShellInner({ initialBlocks = [], onSave = () => {} }) {
  // blocks state and history
  const [blocks, setBlocks] = useState(() => initialBlocks.slice());
  const [selectedId, setSelectedId] = useState(null);
  const historyRef = useRef({ past: [], future: [] });

  useEffect(() => {
    // initialize from props (functional update to avoid using closed-over blocks)
    console.trace('setBlocks from EditorShell.jsx:initialize from initialBlocks');
    setBlocks(() => initialBlocks.slice());
  }, [initialBlocks]);

  // pushHistory accepts either an array or a function(prev=>next)
  const pushHistory = useCallback((nextOrFn) => {
    const hist = historyRef.current;
    setBlocks(prev => {
      // record a deep copy of previous state for undo
      hist.past.push(JSON.parse(JSON.stringify(prev)));
      if (hist.past.length > 50) hist.past.shift();
      hist.future = [];
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      console.trace('setBlocks from EditorShell.jsx:pushHistory');
      return next;
    });
  }, []);

  // Autosave / Version history
  const STORAGE_KEY = 'mailbuilder_autosave_v1';
  const SNAPSHOT_LIMIT = 50;
  const [snapshots, setSnapshots] = useState(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw).snapshots || [] : []; } catch (e) { return []; }
  });

  function persistSnapshots(nextSnapshots) {
    setSnapshots(nextSnapshots);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapshots: nextSnapshots })); } catch (e) { /* ignore */ }
  }

  function takeSnapshot(reason = 'manual') {
    const s = { id: `snap_${Date.now()}`, ts: new Date().toISOString(), reason, blocks: JSON.parse(JSON.stringify(blocks)) };
    const next = [s, ...snapshots].slice(0, SNAPSHOT_LIMIT);
    persistSnapshots(next);
    return s;
  }

  // Autosave on interval and on changes
  const autosaveRef = useRef(null);
  useEffect(() => {
    // restore from last snapshot on mount if present
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.snapshots && data.snapshots.length) {
          // restore the most recent snapshot into blocks (functional update)
          const latest = data.snapshots[0];
          console.trace('setBlocks from EditorShell.jsx:restore snapshot on mount');
          setBlocks(() => latest.blocks || []);
          setSnapshots(data.snapshots || []);
        }
      }
    } catch (e) {}

    autosaveRef.current = setInterval(() => {
      takeSnapshot('autosave');
    }, 10000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // also take a snapshot whenever blocks change (debounced)
  const changeTimer = useRef(null);
  useEffect(() => {
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      takeSnapshot('change');
    }, 1500);
    return () => { if (changeTimer.current) clearTimeout(changeTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // Version history modal
  const [showHistory, setShowHistory] = useState(false);

  function restoreSnapshot(snap) {
    if (!snap) return;
    if (!window.confirm('Restore snapshot from ' + new Date(snap.ts).toLocaleString() + '? This will replace your current editor state.')) return;
    pushHistory(snap.blocks || []);
    // persist to autosave immediately
    takeSnapshot('restore');
  }

  // helpers to find/remove/insert blocks (support nested columns)
  const findAndRemoveBlock = useCallback((list, id) => {
    // try top-level
    const idx = list.findIndex(b => b.id === id);
    if (idx !== -1) {
      const [removed] = list.splice(idx, 1);
      return { removed, list, origin: { type: 'top', index: idx } };
    }
    // search nested columns
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.type === 'columns' && b.meta && Array.isArray(b.meta.blocks)) {
        for (let c = 0; c < b.meta.blocks.length; c++) {
          const col = b.meta.blocks[c];
          const j = col.findIndex(x => x.id === id);
          if (j !== -1) {
            const [removed] = col.splice(j, 1);
            const nextList = JSON.parse(JSON.stringify(list));
            nextList[i].meta.blocks[c] = col;
            return { removed, list: nextList, origin: { type: 'column', columnBlockId: b.id, colIndex: c, index: j } };
          }
        }
      }
    }
    return { removed: null, list, origin: null };
  }, []);

  const insertAtTop = useCallback((list, blockToInsert, index) => {
    const next = list.slice();
    next.splice(index, 0, blockToInsert);
    return next;
  }, []);

  const insertIntoColumn = useCallback((list, columnBlockId, colIndex, blockToInsert, insertIndex = null) => {
    const next = JSON.parse(JSON.stringify(list));
    const outer = next.find(b => b.id === columnBlockId);
    if (!outer) return list;
    if (!outer.meta.blocks) outer.meta.blocks = [[], []];
    const col = outer.meta.blocks[colIndex] || [];
    if (insertIndex === null) col.push(blockToInsert); else col.splice(insertIndex, 0, blockToInsert);
    outer.meta.blocks[colIndex] = col;
    return next;
  }, []);

  const moveExistingBlockToTop = useCallback((draggedId, targetIndex) => {
    // compute next state from prev inside pushHistory to avoid closed-over `blocks`
    pushHistory(prev => {
      const current = JSON.parse(JSON.stringify(prev));
      const { removed, list } = findAndRemoveBlock(current, draggedId);
      if (!removed) return prev;
      const next = insertAtTop(list, removed, targetIndex);
      return next;
    });
  }, [findAndRemoveBlock, insertAtTop, pushHistory]);

  const moveExistingBlockToColumn = useCallback((draggedId, columnBlockId, colIndex, insertIndex = null) => {
    pushHistory(prev => {
      const current = JSON.parse(JSON.stringify(prev));
      const { removed, list } = findAndRemoveBlock(current, draggedId);
      if (!removed) return prev;
      const next = insertIntoColumn(list, columnBlockId, colIndex, removed, insertIndex);
      return next;
    });
  }, [findAndRemoveBlock, insertIntoColumn, pushHistory]);

  const undo = useCallback(() => {
    const hist = historyRef.current;
    if (!hist.past.length) return;
    const prev = hist.past.pop();
    hist.future.unshift(JSON.parse(JSON.stringify(blocks)));
    console.trace('setBlocks from EditorShell.jsx:undo');
    setBlocks(() => prev);
  }, [blocks]);

  const redo = useCallback(() => {
    const hist = historyRef.current;
    if (!hist.future.length) return;
    const next = hist.future.shift();
    hist.past.push(JSON.parse(JSON.stringify(blocks)));
    console.trace('setBlocks from EditorShell.jsx:redo');
    setBlocks(() => next);
  }, [blocks]);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave(blocks);
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'Delete') {
        if (selectedId) {
          e.preventDefault();
          handleDelete(selectedId);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocks, onSave, selectedId, undo]);

  const handleDropAtIndex = useCallback((payload, index) => {
    // payload can be palette type string OR an object { draggedId, origin }
    if (!payload) return;
    if (typeof payload === 'string') {
      const nb = createBlock(payload);
      pushHistory(prev => {
        const next = prev.slice();
        next.splice(index, 0, nb);
        return next;
      });
      setSelectedId(nb.id);
      return;
    }
    // existing block moved
    const { draggedId } = payload;
    moveExistingBlockToTop(draggedId, index);
  }, [blocks, pushHistory, moveExistingBlockToTop]);

  const handleSelect = useCallback((id) => setSelectedId(id), []);

  const handleDelete = useCallback((id) => {
    pushHistory(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId, pushHistory]);

  const updateBlockMeta = useCallback((id, patch) => {
    pushHistory(prev => prev.map(b => b.id === id ? { ...b, meta: { ...b.meta, ...patch } } : b));
  }, [pushHistory]);

  const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedId) || null, [blocks, selectedId]);
  const [previewMode, setPreviewMode] = useState('edit'); // 'edit' | 'preview-desktop' | 'preview-mobile'
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlValue, setHtmlValue] = useState('');
  const [htmlWarning, setHtmlWarning] = useState(null);
  const [inlinedHtml, setInlinedHtml] = useState('');
  const [fetchingInline, setFetchingInline] = useState(false);

  // apply brand styles to editor container
  const { brand } = useBrand();
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  async function saveAsTemplate() {
    if (!templateName) return alert('Please enter a name');
    const payload = { name: templateName, blocks, assets: [] };
    const res = await fetch(`${API_URL}/api/tenants/default/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      setShowSaveTemplate(false);
      alert('Template saved');
    } else {
      const txt = await res.text();
      alert('Save failed: ' + txt);
    }
  }

  function handleEditTemplate(t) {
    if (!window.confirm('Load template "' + t.name + '" into the editor? This will replace current blocks.')) return;
    pushHistory(t.blocks || []);
  }

  // Inline BlockWrapper to provide drag handles for existing blocks
  function BlockWrapper({ block, index, isSelected, onSelect, onDelete, onUpdate, onMove, previewMode }) {
    const [, drag, preview] = useDrag(() => ({ type: BLOCK_TYPE, item: { id: block.id, origin: { type: 'top', index } } }), [block.id, index]);
    // allow dropping other blocks into columns inside this block via props onMove
    return (
      <div ref={preview} className="group">
        <div
          ref={drag}
          role="button"
          tabIndex={0}
          aria-label={`Block ${block.type}`}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect && onSelect(block.id); }}
          className="cursor-grab focus:outline-2 focus:outline-sky-500"
        >
          {/* render block using BlockRenderer component dynamically imported to avoid circular deps */}
          {/* eslint-disable-next-line global-require */}
          {React.createElement(require('../blocks/BlockRenderer').default, { block, onSelect, onUpdate, onDelete, onMove, previewMode })}
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex gap-4 h-full" style={{ background: brand && brand.bodyBackground }}>
        <a href="#editor-canvas" className="skip-link absolute left-[-999px] top-0" onFocus={(e) => { e.target.classList.remove('left-[-999px]'); e.target.classList.add('left-2'); }} onBlur={(e) => { e.target.classList.remove('left-2'); e.target.classList.add('left-[-999px]'); }}>Skip to editor</a>
        {/* Palette */}
  <aside className="w-56 p-3 border-r border-white/6" role="complementary" aria-label="Block palette">
          <h3 className="text-sm font-semibold mb-2">Blocks</h3>
          <PaletteItem type="text" label="Text" />
          <PaletteItem type="image" label="Image" />
          <PaletteItem type="button" label="Button" />
          <PaletteItem type="divider" label="Divider" />
          <PaletteItem type="columns" label="Columns (2)" />
          <PaletteItem type="spacer" label="Spacer" />

          <div className="mt-4">
            <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={() => onSave(blocks)}>Save</button>
            <button className="ml-2 px-3 py-2 bg-slate-700 text-white rounded" onClick={undo}>Undo</button>
            <button className="ml-2 px-3 py-2 bg-slate-700 text-white rounded" onClick={redo}>Redo</button>
          </div>
        </aside>

        {/* Canvas */}
  <main id="editor-canvas" className="flex-1 p-4 overflow-auto" role="main" tabIndex={-1}>
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 mb-4">
              <button className={`px-3 py-1 rounded ${previewMode === 'edit' ? 'bg-sky-600 text-white' : 'bg-white/5'}`} onClick={() => setPreviewMode('edit')}>Edit</button>
              <button className={`px-3 py-1 rounded ${previewMode === 'preview-desktop' ? 'bg-sky-600 text-white' : 'bg-white/5'}`} onClick={() => setPreviewMode('preview-desktop')}>Preview Desktop</button>
              <button className={`px-3 py-1 rounded ${previewMode === 'preview-mobile' ? 'bg-sky-600 text-white' : 'bg-white/5'}`} onClick={() => setPreviewMode('preview-mobile')}>Preview Mobile</button>
              <button className={`px-3 py-1 rounded ${htmlMode ? 'bg-amber-600 text-white' : 'bg-white/5'}`} onClick={() => {
                if (!htmlMode) {
                  // entering HTML mode: serialize
                  const html = serializeBlocksToHtml(blocks, { brand });
                  setHtmlValue(html);
                  setHtmlWarning(null);
                  setHtmlMode(true);
                } else {
                  // leaving HTML mode: attempt to parse back
                  try {
                    const parsed = parseHtmlToBlocks(htmlValue);
                    if (!Array.isArray(parsed) || !parsed.length) {
                      setHtmlWarning('Unable to parse HTML back to blocks. Your edits will not be applied to the visual editor.');
                      setHtmlMode(false);
                      return;
                    }
                    // best-effort: replace blocks with parsed blocks
                    pushHistory(parsed);
                    setHtmlWarning(null);
                    setHtmlMode(false);
                  } catch (err) {
                    setHtmlWarning('Error parsing HTML: ' + String(err));
                    setHtmlMode(false);
                  }
                }
              }}>HTML</button>
              <button className={`px-3 py-1 rounded ${previewMode !== 'edit' ? 'bg-sky-600 text-white' : 'bg-white/5'}`} onClick={async () => {
                // fetch inlined HTML from server
                setFetchingInline(true);
                try {
                  // serialize current blocks to html
                  const html = serializeBlocksToHtml(blocks, { brand });
                  const res = await fetch(`${API_URL}/api/tenants/default/templates/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }) });
                  if (!res.ok) {
                    const txt = await res.text();
                    setInlinedHtml('<pre>Error fetching inline HTML: ' + txt + '</pre>');
                  } else {
                    const j = await res.json();
                    setInlinedHtml(j.html || '');
                  }
                } catch (err) {
                  setInlinedHtml('<pre>Error: ' + String(err) + '</pre>');
                }
                setFetchingInline(false);
                setPreviewMode('preview-desktop');
              }}>{fetchingInline ? 'Generating...' : 'Generate Inline Preview'}</button>
              <button className="px-3 py-1 rounded bg-white/5" title="Undo" onClick={undo}>↶</button>
              <button className="px-3 py-1 rounded bg-white/5" title="Redo" onClick={redo}>↷</button>
              <button className="px-3 py-1 rounded bg-white/5" title="History" onClick={() => setShowHistory(true)}>History</button>
            </div>
            <div className="mx-auto" style={{ width: previewMode === 'preview-mobile' ? 360 : previewMode === 'preview-desktop' ? 800 : '100%' }}>
            {htmlMode && (
              <div className="mb-4">
                {htmlWarning && <div className="text-yellow-400 mb-2">{htmlWarning}</div>}
                {/* react-ace editor for HTML */}
                <ReactAce mode="html" theme="tomorrow" value={htmlValue} onChange={(v) => setHtmlValue(v)} name="html_editor" width="100%" height="400px" setOptions={{ useWorker: false }} />
              </div>
            )}
            <DropZone index={0} onDropAtIndex={handleDropAtIndex} />
            {blocks.map((b, i) => (
              <div key={b.id}>
                <BlockWrapper
                  block={b}
                  index={i}
                  isSelected={b.id === selectedId}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onUpdate={(id, patch) => updateBlockMeta(id, patch)}
                  onMove={(draggedId, to) => {
                    // to: { type: 'column', columnBlockId, colIndex, insertIndex }
                    if (to && to.type === 'column') moveExistingBlockToColumn(draggedId, to.columnBlockId, to.colIndex, to.insertIndex);
                  }}
                  previewMode={previewMode}
                />
                <DropZone index={i + 1} onDropAtIndex={handleDropAtIndex} />
              </div>
            ))}
            </div>
            {/* Preview pane: shows generated inlined HTML when available */}
            {inlinedHtml ? (
              <div className="mt-6">
                <PreviewPane tid={'default'} inlinedHtml={inlinedHtml} defaultDevice={previewMode === 'preview-mobile' ? 'mobile' : 'desktop'} />
              </div>
            ) : null}
          </div>
        </main>

        {/* Inspector */}
        <aside className="w-80 p-4 border-l border-white/6">
          <h3 className="text-sm font-semibold">Inspector</h3>
          <div className="mt-3">
            <BrandSettingsPanel />
            <div className="mt-4">
              <button className="px-3 py-2 bg-sky-600 text-white rounded" onClick={() => setShowSaveTemplate(true)}>Save as Template</button>
            </div>
            <div className="mt-4">
              <TemplateLibrary tid={'default'} onEditTemplate={handleEditTemplate} />
            </div>
          </div>
          {!selectedBlock && <div className="text-sm text-slate-400 mt-2">Select a block to edit its properties</div>}
          {selectedBlock && (
            <div className="mt-3">
              <div className="text-xs text-slate-200 font-medium">{selectedBlock.type}</div>
              <div className="mt-2">
                {/* Common editors: background, padding */}
                <label className="text-xs">Background</label>
                <input type="color" value={(selectedBlock.styles && selectedBlock.styles.background) || '#000000'} onChange={(e) => {
                  const styles = Object.assign({}, selectedBlock.styles || {}, { background: e.target.value });
                  const next = blocks.map(b => b.id === selectedBlock.id ? Object.assign({}, b, { styles }) : b);
                  pushHistory(next);
                }} />

                <label className="text-xs block mt-2">Padding</label>
                <input type="number" value={(selectedBlock.styles && selectedBlock.styles.padding) || 0} onChange={(e) => {
                  const styles = Object.assign({}, selectedBlock.styles || {}, { padding: Number(e.target.value) });
                  const next = blocks.map(b => b.id === selectedBlock.id ? Object.assign({}, b, { styles }) : b);
                  pushHistory(next);
                }} />

                {/* Text-specific */}
                {selectedBlock.type === 'text' && (
                  <div className="mt-3">
                    <label className="text-xs">Content</label>
                    <textarea className="w-full p-2 mt-1 bg-white/5 rounded" value={selectedBlock.meta.content} onChange={(e) => updateBlockMeta(selectedBlock.id, { content: e.target.value })} />

                    <label className="text-xs block mt-2">Font size</label>
                    <input type="number" value={(selectedBlock.styles && selectedBlock.styles.fontSize) || 16} onChange={(e) => {
                      const styles = Object.assign({}, selectedBlock.styles || {}, { fontSize: Number(e.target.value) });
                      const next = blocks.map(b => b.id === selectedBlock.id ? Object.assign({}, b, { styles }) : b);
                      pushHistory(next);
                    }} />

                    <label className="text-xs block mt-2">Color</label>
                    <input type="color" value={(selectedBlock.styles && selectedBlock.styles.color) || '#ffffff'} onChange={(e) => {
                      const styles = Object.assign({}, selectedBlock.styles || {}, { color: e.target.value });
                      const next = blocks.map(b => b.id === selectedBlock.id ? Object.assign({}, b, { styles }) : b);
                      pushHistory(next);
                    }} />
                  </div>
                )}

                {/* Image-specific */}
                {selectedBlock.type === 'image' && (
                  <div className="mt-3">
                    <label className="text-xs">Source</label>
                    <input className="w-full p-2 mt-1 bg-white/5 rounded" value={selectedBlock.meta.src || ''} onChange={(e) => updateBlockMeta(selectedBlock.id, { src: e.target.value })} />
                    <label className="text-xs block mt-2">Alt</label>
                    <input className="w-full p-2 mt-1 bg-white/5 rounded" value={selectedBlock.meta.alt || ''} onChange={(e) => updateBlockMeta(selectedBlock.id, { alt: e.target.value })} />
                  </div>
                )}

                {/* Button-specific */}
                {selectedBlock.type === 'button' && (
                  <div className="mt-3">
                    <label className="text-xs">Label</label>
                    <input className="w-full p-2 mt-1 bg-white/5 rounded" value={selectedBlock.meta.label || ''} onChange={(e) => updateBlockMeta(selectedBlock.id, { label: e.target.value })} />
                    <label className="text-xs block mt-2">URL</label>
                    <input className="w-full p-2 mt-1 bg-white/5 rounded" value={selectedBlock.meta.url || ''} onChange={(e) => updateBlockMeta(selectedBlock.id, { url: e.target.value })} />
                  </div>
                )}

                {/* Columns-specific: not fully editable here except column count */}
                {selectedBlock.type === 'columns' && (
                  <div className="mt-3">
                    <label className="text-xs">Columns</label>
                    <select value={(selectedBlock.meta && selectedBlock.meta.columns) || 2} onChange={(e) => {
                      const columns = Number(e.target.value);
                      const meta = Object.assign({}, selectedBlock.meta || {}, { columns });
                      const next = blocks.map(b => b.id === selectedBlock.id ? Object.assign({}, b, { meta }) : b);
                      pushHistory(next);
                    }}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                    <label className="text-xs block mt-2">Gutter (px)</label>
                    <input type="number" value={(selectedBlock.meta && selectedBlock.meta.gutter) || 16} onChange={(e) => {
                      const gutter = Number(e.target.value);
                      const meta = Object.assign({}, selectedBlock.meta || {}, { gutter });
                      const next = blocks.map(b => b.id === selectedBlock.id ? Object.assign({}, b, { meta }) : b);
                      pushHistory(next);
                    }} />
                  </div>
                )}

              {/* Save-as-Template modal */}
              {showSaveTemplate && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50">
                  <div className="bg-white/6 p-4 rounded">
                    <h4 className="text-sm font-semibold">Save Template</h4>
                    <input className="w-full p-2 mt-2 bg-white/5 rounded" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
                    <div className="mt-3 flex gap-2">
                      <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={saveAsTemplate}>Save</button>
                      <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={() => setShowSaveTemplate(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

                {/* Spacer-specific */}
                {selectedBlock.type === 'spacer' && (
                  <div className="mt-3">
                    <label className="text-xs">Height</label>
                    <input type="range" min={0} max={200} value={(selectedBlock.meta && selectedBlock.meta.height) || 16} onChange={(e) => updateBlockMeta(selectedBlock.id, { height: Number(e.target.value) })} />
                    <input type="number" className="w-full mt-2" min={0} max={200} value={(selectedBlock.meta && selectedBlock.meta.height) || 16} onChange={(e) => updateBlockMeta(selectedBlock.id, { height: Number(e.target.value) })} />
                  </div>
                )}

                {/* Divider-specific */}
                {selectedBlock.type === 'divider' && (
                  <div className="mt-3">
                    <label className="text-xs">Thickness (px)</label>
                    <input type="range" min={1} max={20} value={(selectedBlock.meta && (selectedBlock.meta.thickness || selectedBlock.meta.height)) || 1} onChange={(e) => updateBlockMeta(selectedBlock.id, { thickness: Number(e.target.value) })} />
                    <input type="number" className="w-full mt-2" min={1} max={20} value={(selectedBlock.meta && (selectedBlock.meta.thickness || selectedBlock.meta.height)) || 1} onChange={(e) => updateBlockMeta(selectedBlock.id, { thickness: Number(e.target.value) })} />

                    <label className="text-xs block mt-2">Style</label>
                    <label className="inline-flex items-center gap-2 mt-1">
                      <input type="checkbox" checked={!!(selectedBlock.meta && selectedBlock.meta.dashed)} onChange={(e) => updateBlockMeta(selectedBlock.id, { dashed: e.target.checked })} />
                      <span className="text-xs">Dashed</span>
                    </label>

                    <label className="text-xs block mt-2">Color</label>
                    <input type="color" value={(selectedBlock.meta && selectedBlock.meta.color) || '#e6e6e6'} onChange={(e) => updateBlockMeta(selectedBlock.id, { color: e.target.value })} />
                  </div>
                )}

              </div>
            </div>
          )}
        </aside>
        {showHistory && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
            <div className="w-3/4 max-h-[80vh] overflow-auto bg-white/5 p-4 rounded">
              <h3 className="text-lg font-semibold">Version History</h3>
              <div className="mt-3 space-y-2">
                {snapshots.map(s => (
                  <div key={s.id} className="p-2 bg-white/3 rounded flex justify-between items-start">
                    <div>
                      <div className="font-medium">{new Date(s.ts).toLocaleString()}</div>
                      <div className="text-xs text-slate-400">{s.reason}</div>
                      <pre className="mt-2 text-xs bg-black/10 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(s.blocks.slice(0,3), null, 2)}{s.blocks.length > 3 ? '\n...':'\n'}</pre>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="px-2 py-1 bg-emerald-600 text-white rounded" onClick={() => { restoreSnapshot(s); }}>Restore</button>
                      <button className="px-2 py-1 bg-slate-700 text-white rounded" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(s.blocks)); alert('Copied snapshot JSON'); }}>Copy</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-right">
                <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={() => setShowHistory(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}

export default function EditorShell(props) {
  // wrap with BrandProvider so brand settings are available
  return (
    <BrandProvider tid={'default'}>
      <EditorShellInner {...props} />
    </BrandProvider>
  );
}
