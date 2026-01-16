#!/usr/bin/env node
// Example script that demonstrates building a tracked URL and generating a table-based YouTube-style subscribe button HTML.
// Usage: node scripts/sendExample.js

import { buildTrackedUrl } from '../server/utils/urlBuilder.js';

// If your project doesn't have buildTrackedUrl, replace or implement a minimal version here for testing.
// Minimal fallback (uncomment if needed):
// export function buildTrackedUrl({ linkId, recipientId }) {
//   const token = `${linkId}:${recipientId}`; // <-- placeholder; replace with real token generation
//   return `https://example.com/r/${encodeURIComponent(token)}`;
// }

function buildSubscribeButtonHtml({ href, text = 'Subscribe', bg = '#ff0000', color = '#ffffff', placement = 'center' } = {}) {
  // Minimal, email-safe table-based CTA styled similar to YouTube subscribe button
  // placement: 'left' | 'center' | 'right'
  const align = placement === 'left' ? 'left' : placement === 'right' ? 'right' : 'center';
  const escapedHref = href.replace(/"/g, '%22');

  return `<!-- YouTube-style subscribe CTA -->\n<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="margin:0 auto;">
  <tr>
    <td align="center" valign="middle" style="border-radius:4px; background:${bg}; padding:0;">
      <a href="${escapedHref}" target="_blank" style="display:inline-block; padding:10px 16px; color:${color}; text-decoration:none; font-family: Arial, sans-serif; font-size:14px; font-weight:700;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

async function main() {
  // Fake identifiers for demo
  const linkId = 'demo-link-123';
  const recipientId = 'user-456@example.com';

  // Build tracked URL (this function should generate a link that routes to your /r/:token endpoint)
  let trackedUrl;
  try {
    trackedUrl = buildTrackedUrl({ linkId, recipientId });
  } catch (err) {
    console.error('Could not call buildTrackedUrl from server/utils/urlBuilder.js — ensure it exists. Falling back to a simple demo URL.');
    trackedUrl = `https://example.com/r/${encodeURIComponent(linkId + '::' + recipientId)}`;
  }

  console.log('Tracked URL:');
  console.log(trackedUrl);
  console.log('\nSubscribe button HTML:');

  const html = buildSubscribeButtonHtml({ href: trackedUrl, text: 'Subscribe', bg: '#cc0000', color: '#ffffff', placement: 'center' });
  console.log(html);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
