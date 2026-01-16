import React, { useEffect, useRef, useState } from 'react';

export default function PreviewModal({ open, isOpen, onClose, imageDataUrl, includeAnimatedOverlay = true }) {
  // support both `open` and `isOpen` prop names for callers
  if (typeof isOpen === 'undefined') isOpen = open;
  const modalRef = useRef(null);
  const [tweetUploading, setTweetUploading] = useState(false);
  const subreddit = 'Fotonix'; // locked subreddit
  // shared button appearance for preview modal actions
  const actionBtnClass = "px-4 py-1.5 rounded border border-white/80 bg-black text-white flex items-center gap-2 whitespace-nowrap text-sm";
  const actionBtnStyle = { minHeight: 40 };
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement;
    try { modalRef.current && modalRef.current.focus(); } catch {}
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); try { prev && prev.focus && prev.focus(); } catch {} };
  }, [open, onClose]);

  if (!isOpen) return null;

  // convert dataURL to blob (helper) for download/clipboard
  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function handleDownload() {
    if (!imageDataUrl) return;
    const a = document.createElement('a');
    a.href = imageDataUrl; a.download = 'mirror-preview.png'; a.click();
  }

  async function handleCopyImage() {
    if (!imageDataUrl) return alert('No image to copy');
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        const blob = await dataUrlToBlob(imageDataUrl);
        const item = new window.ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        alert('Image copied to clipboard');
      } catch (e) {
        console.warn('Clipboard image write failed', e);
        // fallback to copying data URL text
        try { await navigator.clipboard.writeText(imageDataUrl); alert('Data URL copied to clipboard (fallback)'); } catch { alert('Copy failed'); }
      }
    } else {
      try { await navigator.clipboard.writeText(imageDataUrl); alert('Data URL copied to clipboard'); } catch { alert('Copy not supported'); }
    }
  }

  async function handleTweet() {
    if (!imageDataUrl) return alert('No image to share');
    setTweetUploading(true);
    try {
      console.log('[PreviewModal] preparing tweet popup and uploading preview');
      const text = encodeURIComponent('Check out my mirror design!');
      const initialUrl = window.location.href;
      const initialIntent = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(initialUrl)}`;
      // Open or reuse a single named popup to avoid multiple windows
      let popup = null;
      let usedAnchorFallback = false;
      try {
        popup = window.open('', 'fotonix_share');
        if (popup) {
          try { popup.location.href = initialIntent; } catch (e) { /* harmless if cross-origin */ }
        }
      } catch (e) { console.warn('window.open threw', e); }
      if (!popup) {
        // anchor fallback
        try {
          const a = document.createElement('a');
          a.href = initialIntent;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          usedAnchorFallback = true;
        } catch (e) {
          console.warn('anchor fallback failed', e);
          alert('Popup blocked. Please allow popups for this site and try again.');
          setTweetUploading(false);
          return;
        }
      }

      // perform upload and update popup to include publicUrl when available
      // set uploading state after popup is initiated to avoid blocking
      setTweetUploading(true);
      const resp = await fetch('/api/upload-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
      const j = await resp.json();
        const imageUrl = j && j.imageUrl;
        const publicUrl = j && (j.publicUrl || j.url);
        const productUrl = j && j.productUrl;
        const urlForTweet = imageUrl || publicUrl || productUrl;
      if (urlForTweet) {
        const updatedIntent = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(urlForTweet)}`;
        try {
          if (usedAnchorFallback) {
            // Anchor fallback already opened a tab; avoid opening another.
          } else if (popup && !popup.closed) {
            popup.location.href = updatedIntent;
          } else {
            window.open(updatedIntent, '_blank');
          }
        } catch (e) { console.warn('Unable to redirect popup to updated intent', e); }
      }
    } catch (e) {
      console.warn('[PreviewModal] tweet upload failed, falling back to mock behavior', e);
      try {
        // open the image data URL in the already-opened popup (or new tab) so user can inspect/save
        const popup = window.open('', '_blank', 'noopener');
        if (popup) {
          try { popup.location.href = imageDataUrl; } catch (ex) { console.warn('Failed to set popup to data URL', ex); popup.close && popup.close(); }
        } else {
          // final fallback: open in current tab
          try { window.open(imageDataUrl, '_blank', 'noopener'); } catch (ex) { console.warn('Failed to open data URL', ex); }
        }
      } catch (ex) { console.warn('Failed fallback image open', ex); }
      // ensure the tweet intent is open (use current page as mock link)
      try { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out my mirror design!')}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener'); } catch (ex) { console.warn('Failed to open tweet intent fallback', ex); }
    } finally {
      setTweetUploading(false);
    }
  }

  async function handleReddit() {
    if (!imageDataUrl) return alert('No image to share');
    setTweetUploading(true);
    try {
      const title = encodeURIComponent('Check out my mirror design!');
      const initialUrl = window.location.href;
      const initialSubmit = `https://www.reddit.com/submit?url=${encodeURIComponent(initialUrl)}&title=${title}`;

      // open popup synchronously with initial submit URL
      let popup = null;
      try { popup = window.open(initialSubmit, '_blank'); } catch (e) { console.warn('window.open threw', e); }
      if (!popup) {
        // anchor fallback
        try {
          const a = document.createElement('a'); a.href = initialSubmit; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (e) {
          console.warn('anchor fallback failed', e);
          alert('Popup blocked. Please allow popups for this site and try again.');
          setTweetUploading(false);
          return;
        }
      }
      // call server-side submit helper which uploads and posts to reddit (server must be configured with Reddit app creds)
      try {
        const r = await fetch('/api/submit-to-reddit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl, title: decodeURIComponent(title), sr: subreddit }) });
        const jr = await r.json();
        if (r.ok && jr && jr.reddit && jr.reddit.postUrl) {
          const postUrl = jr.reddit.postUrl;
          try { if (popup && !popup.closed) popup.location.href = postUrl; else window.open(postUrl, '_blank'); } catch (e) { console.warn('Unable to redirect popup to reddit post', e); }
        } else if (r.ok && jr && jr.reddit && jr.reddit.success && jr.reddit.postUrl) {
          const postUrl = jr.reddit.postUrl;
          try { if (popup && !popup.closed) popup.location.href = postUrl; else window.open(postUrl, '_blank'); } catch (e) { console.warn('Unable to redirect popup to reddit post', e); }
        } else {
          // fallback: if server didn't create a post, but returned upload info, redirect to reddit submit with the upload URL
          const uploaded = jr && jr.upload;
          const urlForReddit = uploaded && (uploaded.imageUrl || uploaded.productUrl || uploaded.publicUrl || uploaded.url);
          if (urlForReddit) {
            const srParam = subreddit ? `&sr=${encodeURIComponent(subreddit)}` : '';
            const submitUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(urlForReddit)}&title=${title}${srParam}`;
            try { if (popup && !popup.closed) popup.location.href = submitUrl; else window.open(submitUrl, '_blank'); } catch (e) { console.warn('Unable to redirect popup to reddit submit', e); }
          } else {
            // final fallback: open reddit submit with current page
            try { if (popup && !popup.closed) popup.location.href = `https://www.reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${title}`; else window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${title}`, '_blank'); } catch (ex) { console.warn('reddit fallback failed', ex); }
          }
        }
      } catch (ex) {
        console.warn('server-side reddit submit failed', ex);
        try { if (popup && !popup.closed) popup.location.href = `https://www.reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${title}`; else window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${title}`, '_blank'); } catch (ex2) { console.warn('reddit fallback failed', ex2); }
      }
    } catch (e) {
      console.warn('[PreviewModal] reddit upload failed', e);
      try { window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent('Check out my mirror design!')}`, '_blank'); } catch (ex) { console.warn('reddit fallback failed', ex); }
    } finally {
      setTweetUploading(false);
    }
  }

  async function handleShare() {
    if (!navigator.share) return alert('Web Share API not available');
    try {
      const blob = await dataUrlToBlob(imageDataUrl);
      const file = new File([blob], 'mirror-preview.png', { type: blob.type });
      await navigator.share({ files: [file], title: 'Mirror design', text: 'Check out my mirror design' });
    } catch (e) {
      console.warn('Share failed', e); alert('Share failed: ' + (e && e.message ? e.message : e));
    }
  }

  async function handleFacebook() {
    if (!imageDataUrl) return alert('No image to share');
    // Open or reuse a single named popup to avoid multiple windows
    const initialUrl = window.location.href;
    const initialShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(initialUrl)}`;
    let popup = null;
    let usedAnchorFallback = false;
    try {
      popup = window.open('', 'fotonix_share');
      if (popup) {
        try { popup.location.href = initialShare; } catch (e) { /* ignore cross-origin nav errors */ }
      }
    } catch (e) { console.warn('window.open threw', e); }
    if (!popup) {
      try {
        const a = document.createElement('a'); a.href = initialShare; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        usedAnchorFallback = true;
      } catch (e) { console.warn('anchor fallback failed', e); alert('Popup blocked. Please allow popups for this site and try again.'); return; }
    }
    try {
      const resp = await fetch('/api/upload-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl }) });
      if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
      const j = await resp.json();
      const productUrl = j && j.productUrl;
        const imageUrl = j && j.imageUrl;
        const publicUrl = j && (j.publicUrl || j.url);
        const shareUrl = imageUrl || publicUrl || productUrl || initialUrl;
      const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      try {
        if (usedAnchorFallback) {
          // Avoid opening a second window if anchor fallback already opened one
        } else if (popup && !popup.closed) {
          popup.location.href = fbShare;
        } else {
          window.open(fbShare, '_blank');
        }
      } catch (e) { console.warn('Unable to redirect popup to FB share', e); }
    } catch (e) {
      console.warn('[PreviewModal] facebook upload failed', e);
      try { if (popup && !popup.closed) popup.location.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`; else window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank'); } catch (ex) { console.warn('facebook fallback failed', ex); }
    }
  }

  async function handlePinterest() {
    if (!imageDataUrl) return alert('No image to share');
    const initialUrl = window.location.href;
    // open named popup to avoid multiple windows
    let popup = null;
    let usedAnchorFallback = false;
    try { popup = window.open('', 'fotonix_share'); if (popup) { try { popup.location.href = 'about:blank'; } catch(e) {} } } catch(e){ console.warn('window.open failed', e); }
    if (!popup) {
      try { const a = document.createElement('a'); a.href = '#'; a.target = '_blank'; a.rel='noopener noreferrer'; a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); usedAnchorFallback = true; } catch(e){ console.warn('anchor fallback failed', e); }
    }

    try {
      const resp = await fetch('/api/upload-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl }) });
      if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
      const j = await resp.json();
      const imageUrl = j && j.imageUrl;
      const productUrl = j && j.productUrl;
      const publicUrl = j && (j.publicUrl || j.url);
      const sharePage = publicUrl || productUrl || initialUrl;
      const media = imageUrl || publicUrl;
      const description = encodeURIComponent('Check out my mirror design!');
      const pinUrl = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(sharePage)}&media=${encodeURIComponent(media)}&description=${description}`;
      try { if (!usedAnchorFallback && popup && !popup.closed) popup.location.href = pinUrl; else window.open(pinUrl, '_blank'); } catch(e){ console.warn('Unable to open pinterest', e); }
    } catch (e) {
      console.warn('[PreviewModal] pinterest upload failed', e);
      try { window.open(`https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}&media=${encodeURIComponent(imageDataUrl)}&description=${encodeURIComponent('Check out my mirror design!')}`, '_blank'); } catch (ex) { console.warn('pinterest fallback failed', ex); }
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div ref={modalRef} tabIndex={-1} className="max-w-3xl w-full bg-white/5 rounded-lg p-4 shadow-lg" style={{ outline: 'none' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">Preview & Share</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className={actionBtnClass} style={actionBtnStyle}>Download</button>
            <button onClick={handleCopyImage} className={actionBtnClass} style={actionBtnStyle}>Copy Image</button>
            <button onClick={handleShare} disabled={tweetUploading} className={actionBtnClass} aria-disabled={tweetUploading} style={actionBtnStyle}>Share</button>
            {/* Icon above text for compact buttons */}
            <button onClick={handleTweet} disabled={tweetUploading} className={actionBtnClass + ' flex-col'} aria-disabled={tweetUploading} style={actionBtnStyle}>
              <img src="/images/bottomXlogo.png" alt="X" style={{ width: 18, height: 18, display: 'inline-block' }} />
              <span className="text-xs">{tweetUploading ? 'Uploading…' : 'Tweet'}</span>
            </button>
            <button onClick={handleFacebook} disabled={tweetUploading} className={actionBtnClass + ' flex-col'} aria-disabled={tweetUploading} style={actionBtnStyle}>
              <img src="/images/facebookF.png" alt="Facebook" style={{ width: 18, height: 18, display: 'inline-block' }} />
              <span className="text-xs">FB</span>
            </button>
            <button
              onClick={handleReddit}
              disabled={tweetUploading}
              aria-label="Post to r/Fotonix"
              className={actionBtnClass + ' flex-col'}
              style={actionBtnStyle}
            >
              <img src="/images/bottomRedditLogo.png" alt="Reddit" style={{ width: 18, height: 18, display: 'inline-block' }} />
              <span className="text-xs">Post</span>
            </button>
            <button onClick={handlePinterest} disabled={tweetUploading} className={actionBtnClass + ' flex-col'} aria-disabled={tweetUploading} style={actionBtnStyle}>
              <img src="/images/pinterestlogo.png" alt="Pinterest" style={{ width: 18, height: 18, display: 'inline-block' }} />
              <span className="text-xs">Pin</span>
            </button>
            <button onClick={onClose} className={actionBtnClass} style={actionBtnStyle} aria-label="Close">X</button>
          </div>
        </div>

        <div className="w-full flex justify-center">
          <div className="relative rounded-md overflow-hidden bg-slate-800" style={{ maxWidth: '100%', width: '100%', height: 'auto' }}>
            <img src={imageDataUrl} alt="Preview" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain' }} />

            {/* Animated overlay (CSS) - easy to remove */}
            {includeAnimatedOverlay && (
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#ff007f,#ff7a00,#ffd100,#2cff6c,#00e7ff,#7b5cff)', backgroundSize: '400% 100%', opacity: 0.6, animation: 'rainbowMove 6s linear infinite' }} />
                <style>{`@keyframes rainbowMove { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }`}</style>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
