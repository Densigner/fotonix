import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function TextEditor({ content = '', onChange = () => {}, readOnly = false, styles = {}, onFocus = () => {} }) {
  const ref = useRef(null);
  const [showToolbar, setShowToolbar] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    // Don't clobber user selection while editing
    if (document.activeElement !== ref.current) ref.current.innerHTML = content || '';
  }, [content]);

  useEffect(() => {
    function onSelectionChange() {
      if (readOnly) return setShowToolbar(false);
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return setShowToolbar(false);
      const node = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
      if (ref.current && ref.current.contains(node)) setShowToolbar(true); else setShowToolbar(false);
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [readOnly]);

  function exec(cmd, value) {
    if (readOnly) return;
    document.execCommand(cmd, false, value);
    // forward HTML
    onChange(ref.current.innerHTML);
  }

  function onInput() {
    onChange(ref.current.innerHTML);
  }

  if (readOnly) {
    // render sanitized HTML-like preview (no editing controls)
    return (
      <div className="prose" style={{ fontSize: (styles && styles.fontSize) || 16, color: (styles && styles.color) || '#fff' }} dangerouslySetInnerHTML={{ __html: content || '' }} />
    );
  }

  return (
    <div className="relative">
      {showToolbar && (
        <div className="absolute -top-10 left-0 flex gap-2 bg-black/60 p-1 rounded">
          <button onMouseDown={(e)=>{ e.preventDefault(); exec('bold'); }} className="px-2 py-1">B</button>
          <button onMouseDown={(e)=>{ e.preventDefault(); exec('italic'); }} className="px-2 py-1">I</button>
          <button onMouseDown={(e)=>{ e.preventDefault(); {
            const url = prompt('Insert link URL'); if (url) exec('createLink', url);
          } }} className="px-2 py-1">Link</button>
          <button onMouseDown={(e)=>{ e.preventDefault(); exec('insertUnorderedList'); }} className="px-2 py-1">• List</button>
        </div>
      )}

      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={onInput}
        onFocus={() => onFocus()}
        className="min-h-[40px] p-1"
        style={{ fontSize: (styles && styles.fontSize) || 16, color: (styles && styles.color) || '#fff' }}
      >
        {content}
      </div>
    </div>
  );
}

TextEditor.propTypes = {
  content: PropTypes.string,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool,
  styles: PropTypes.object,
  onFocus: PropTypes.func,
};
