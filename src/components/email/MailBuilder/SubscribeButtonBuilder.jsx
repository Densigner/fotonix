import React, { useState, useMemo } from 'react';

/**
 * SubscribeButtonBuilder
 * Props:
 *  - onInsert(html) : function to call when inserting into editor (optional)
 */
export default function SubscribeButtonBuilder({ onInsert }) {
  const [channel, setChannel] = useState('');
  const [ctaText, setCtaText] = useState('▶ Subscribe on YouTube');
  const [buttonBg, setButtonBg] = useState('#FF0000');
  const [buttonText, setButtonText] = useState('#FFFFFF');
  const [utmSource, setUtmSource] = useState('newsletter');
  const [utmMedium, setUtmMedium] = useState('email');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [align, setAlign] = useState('center');
  const [borderRadius, setBorderRadius] = useState(6);

  // Normalize channel input into a usable URL (best-effort)
  function normalizeChannelLink(input) {
    if (!input) return '';
    let s = input.trim();
    if (s.startsWith('@')) s = s.slice(1);
    // If user entered a full url, return as-is
    if (/^https?:\/\//i.test(input)) return input;
    // If looks like a handle, convert to handle URL
    if (/^[A-Za-z0-9_.-]+$/.test(s)) {
      return `https://www.youtube.com/@${s}`;
    }
    return input; // fallback: return raw
  }

  function buildSubscribeButtonHTML(opts = {}) {
    const {
      channelLink, ctaText, buttonBg, buttonText, utmSource, utmMedium, utmCampaign, borderRadius, align
    } = opts;

    const safeChannel = channelLink || '';
    // append sub_confirmation and UTM safely
    let href = safeChannel;
    try {
      if (!href) href = '#';
      const u = new URL(href, 'https://example.com'); // base to parse relative
      u.searchParams.set('sub_confirmation', '1');
      if (utmSource) u.searchParams.set('utm_source', utmSource);
      if (utmMedium) u.searchParams.set('utm_medium', utmMedium);
      if (utmCampaign) u.searchParams.set('utm_campaign', utmCampaign);
      // If original was relative (we used base), and original didn't have protocol, keep original href but append query
      if (/^https?:\/\//i.test(safeChannel)) {
        href = u.toString();
      } else {
        // best effort: append query string
        const q = u.search;
        href = safeChannel + q;
      }
    } catch (e) {
      // fallback manual concat
      const sep = safeChannel.includes('?') ? '&' : '?';
      const parts = [`sub_confirmation=1`];
      if (utmSource) parts.push(`utm_source=${encodeURIComponent(utmSource)}`);
      if (utmMedium) parts.push(`utm_medium=${encodeURIComponent(utmMedium)}`);
      if (utmCampaign) parts.push(`utm_campaign=${encodeURIComponent(utmCampaign)}`);
      href = safeChannel ? safeChannel + sep + parts.join('&') : '#';
    }

    const html = `
<table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
  <tr>
    <td align="center" bgcolor="${buttonBg}" style="border-radius:${borderRadius}px;padding:0;">
      <a href="${href}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;color:${buttonText};text-decoration:none;border-radius:${borderRadius}px;">
         ${ctaText}
      </a>
    </td>
  </tr>
</table>`.trim();

    return html;
  }

  const normalizedLink = useMemo(() => normalizeChannelLink(channel), [channel]);

  const generatedHtml = useMemo(() => buildSubscribeButtonHTML({
    channelLink: normalizedLink,
    ctaText,
    buttonBg,
    buttonText,
    utmSource,
    utmMedium,
    utmCampaign,
    borderRadius,
    align
  }), [normalizedLink, ctaText, buttonBg, buttonText, utmSource, utmMedium, utmCampaign, borderRadius, align]);

  const canInsert = Boolean(normalizedLink && normalizedLink !== '#');

  function copyToClipboard() {
    if (!navigator.clipboard) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = generatedHtml;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return;
    }
    navigator.clipboard.writeText(generatedHtml);
  }

  function handleInsert() {
    if (!canInsert) return;
    if (typeof onInsert === 'function') {
      // Provide both the generated HTML and a structured options object so callers
      // (e.g. the editor) can insert a block with rich metadata instead of just
      // pasting HTML.
      const opts = {
        channelLink: normalizedLink,
        ctaText,
        buttonBg,
        buttonText,
        utmSource,
        utmMedium,
        utmCampaign,
        align,
        borderRadius
      };
      onInsert(generatedHtml, opts);
    } else {
      // fallback: copy to clipboard
      copyToClipboard();
    }
  }

  return (
    <div style={{padding:12, maxWidth:420}}>
      <div style={{display:'grid', gap:8}}>
        <label style={{fontSize:12,color:'#333'}}>Channel URL or handle</label>
        <input value={channel} onChange={(e)=>setChannel(e.target.value)} placeholder="@YourHandle or https://youtube.com/..." style={{width:'100%',padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}} />

        <label style={{fontSize:12,color:'#333'}}>CTA text</label>
        <input value={ctaText} onChange={(e)=>setCtaText(e.target.value)} style={{width:'100%',padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}} />

        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1}}>
            <label style={{fontSize:12,color:'#333'}}>Button background</label>
            <input type="color" value={buttonBg} onChange={(e)=>setButtonBg(e.target.value)} style={{width:'100%',height:38,background:'#fff'}} />
          </div>
          <div style={{width:120}}>
            <label style={{fontSize:12,color:'#333'}}>Text color</label>
            <input type="color" value={buttonText} onChange={(e)=>setButtonText(e.target.value)} style={{width:'100%',height:38,background:'#fff'}} />
          </div>
        </div>

        <div style={{display:'flex',gap:8}}>
          <input value={utmSource} onChange={(e)=>setUtmSource(e.target.value)} placeholder="utm_source" style={{flex:1,padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}} />
          <input value={utmMedium} onChange={(e)=>setUtmMedium(e.target.value)} placeholder="utm_medium" style={{flex:1,padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}} />
        </div>

        <input value={utmCampaign} onChange={(e)=>setUtmCampaign(e.target.value)} placeholder="utm_campaign (optional)" style={{width:'100%',padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}} />

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:12,color:'#333'}}>Alignment:</label>
          <select value={align} onChange={(e)=>setAlign(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}}>
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>

          <label style={{fontSize:12,color:'#333',marginLeft:8}}>Border radius</label>
          <input type="number" value={borderRadius} onChange={(e)=>setBorderRadius(Number(e.target.value||0))} style={{width:80,padding:8,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}} />
        </div>

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button onClick={copyToClipboard} style={{flex:1,padding:10,borderRadius:6,border:'1px solid #ddd',background:'#fff',color:'#000'}}>Copy HTML</button>
          <button onClick={handleInsert} style={{flex:1,padding:10,borderRadius:6,border:'0',background: canInsert ? '#0b74de' : '#999',color:'#fff'}} disabled={!canInsert}>Insert into editor</button>
        </div>

        <div style={{marginTop:12}}>
          <div style={{fontSize:12,color:'#666',marginBottom:6}}>Preview</div>
          <div style={{padding:12,background:'#f7f7f7',borderRadius:6}}>
            <div dangerouslySetInnerHTML={{ __html: generatedHtml }} />
            <div style={{fontSize:11,color:'#666',marginTop:8}}>Note: this preview approximates how the button will appear in email. The actual email client may vary.</div>
          </div>
        </div>
      </div>
    </div>
  );
}