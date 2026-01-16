import React, { useEffect, useRef, useState } from 'react';
import LEDMockupGlass from '../designers/LEDMockupGlass';

export default function PreviewModalGlass({ open, onClose, mockSrc, title = 'Preview & Share', ringExpandPx = 10, ringThicknessPx = 6, platePaddingPx = 12, maxArtWidth = 420 }) {
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(false);
  // compact button appearance
  const actionBtnClass = "px-2 py-1 rounded border border-white/80 bg-black text-white flex items-center gap-2 whitespace-nowrap text-xs";
  const actionBtnStyle = { minHeight: 32 };
  const shareText = 'Check Out my Side Lit Accrylic';

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    try { modalRef.current && modalRef.current.focus(); } catch (e) {}
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      try { prev && prev.focus && prev.focus(); } catch (e) {}
    };
  }, [open, onClose]);

  if (!open) return null;

  function downloadImage() {
    if (!mockSrc) return;
    const a = document.createElement('a');
    a.href = mockSrc;
    a.download = 'lamp-preview.png';
    a.click();
  }

  async function copyImage() {
    if (!mockSrc) return alert('No preview to copy');
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        const res = await fetch(mockSrc);
        const blob = await res.blob();
        const item = new window.ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        alert('Preview copied to clipboard');
        return;
      } catch (e) {
        console.warn('clipboard image failed', e);
      }
    }
    try {
      await navigator.clipboard.writeText(mockSrc);
      alert('Data URL copied to clipboard');
    } catch (e) {
      alert('Copy not supported');
    }
  }

  function shareWeb() {
    if (!navigator.share) return alert('Web Share API not available');
    (async () => {
      try {
        const res = await fetch(mockSrc);
        const blob = await res.blob();
        const file = new File([blob], 'lamp-preview.png', { type: blob.type });
        await navigator.share({ files: [file], title: shareText, text: shareText });
      } catch (e) {
        console.warn('share failed', e);
        alert('Share failed');
      }
    })();
  }

  function tweet() {
    const text = encodeURIComponent(shareText);
    const url = encodeURIComponent(window.location.href);
    const intent = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    window.open(intent, '_blank');
  }

  function facebook() {
    const url = encodeURIComponent(window.location.href);
    const intent = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(intent, '_blank');
  }

  function reddit() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(shareText);
    const intent = `https://www.reddit.com/submit?url=${url}&title=${title}`;
    window.open(intent, '_blank');
  }

  function pinterest() {
    const url = encodeURIComponent(window.location.href);
    const media = encodeURIComponent(mockSrc || '');
    const description = encodeURIComponent(shareText);
    const intent = `https://www.pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${description}`;
    window.open(intent, '_blank');
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div ref={modalRef} tabIndex={-1} className="max-w-xl w-full bg-white/5 rounded-lg p-3 shadow-lg" style={{ outline: 'none' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-md font-semibold text-slate-100">{title}</h2>
          <div className="flex items-center gap-2">
            <button onClick={downloadImage} className={actionBtnClass} style={actionBtnStyle}>Download</button>
            <button onClick={copyImage} className={actionBtnClass} style={actionBtnStyle}>Copy</button>
            <button onClick={shareWeb} className={actionBtnClass} style={actionBtnStyle}>Share</button>
            <button onClick={tweet} className={actionBtnClass + ' flex-col items-center'} style={actionBtnStyle}>
              <img src="/images/bottomXlogo.png" alt="X" style={{ width: 16, height: 16, display: 'inline-block' }} />
              <span className="text-[10px]">Tweet</span>
            </button>
            <button onClick={facebook} className={actionBtnClass + ' flex-col items-center'} style={actionBtnStyle}>
              <img src="/images/facebookF.png" alt="Facebook" style={{ width: 16, height: 16, display: 'inline-block' }} />
              <span className="text-[10px]">FB</span>
            </button>
            <button onClick={reddit} className={actionBtnClass + ' flex-col items-center'} style={actionBtnStyle}>
              <img src="/images/bottomRedditLogo.png" alt="Reddit" style={{ width: 16, height: 16, display: 'inline-block' }} />
              <span className="text-[10px]">Post</span>
            </button>
            <button onClick={pinterest} className={actionBtnClass + ' flex-col items-center'} style={actionBtnStyle}>
              <img src="/images/pinterestlogo.png" alt="Pinterest" style={{ width: 16, height: 16, display: 'inline-block' }} />
              <span className="text-[10px]">Pin</span>
            </button>
            <button onClick={onClose} className={actionBtnClass} style={actionBtnStyle}>X</button>
          </div>
        </div>

        <div className="w-full flex justify-center">
          <div className="relative rounded-md overflow-hidden bg-slate-800" style={{ maxWidth: '100%', width: '100%', height: 'auto' }}>
            <LEDMockupGlass src={mockSrc} title={title} ringExpandPx={ringExpandPx} ringThicknessPx={ringThicknessPx} platePaddingPx={platePaddingPx} maxArtWidth={maxArtWidth} />
          </div>
        </div>
      </div>
    </div>
  );
}
