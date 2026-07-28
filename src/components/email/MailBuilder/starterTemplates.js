// Real starter templates for the "New Campaign" landing screen
// (src/components/automationscomposer/AutomationsEditor.js).
//
// The six preset files below (welcomePreset.js etc.) already existed with
// good content, but were written against a DIFFERENT block schema
// (`{ id, type, data, children }`) than what AutomationsEditor.js's own
// editor actually uses (`{ id, type, meta }`, see its `defaultBlock()` and
// `renderBlockPreviewEmail()`) — e.g. a text block's copy lives at
// `data.html` in the presets but this editor reads `meta.content`. Passing
// the preset blocks through unconverted crashed the editor outright
// (`Cannot read properties of undefined (reading 'align')`, since every
// block's `meta` was undefined) the instant "Use / Edit" was clicked —
// confirmed by actually running the app and reproducing it, not just
// reading code. convertBlocks() below is the translation layer; this file
// still exports the block arrays and their own schema unchanged, in case
// something else (a different editor) ever wants the original shape.
import { welcomeBlocks } from './welcomePreset';
import { emptyBlocks } from './emptyPreset';
import { birthdayBlocks } from './birthdayPreset';
import { blogNewsletterBlocks } from './blogNewsletterPreset';
import { exploreBlocks } from './explorePreset';
import { shareStoryBlocks } from './shareStoryPreset';

function stripHtml(html) {
  return (html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

// Converts one preset-shaped block into AutomationsEditor's native shape.
// 'section' has no equivalent container concept there, so its children are
// flattened straight into the parent list (returns an array, not a block).
function convertBlock(block) {
  const data = block.data || {};
  switch (block.type) {
    case 'title':
      return { id: block.id, type: 'text', meta: { content: data.text || '', align: data.align || 'center', fontSize: (data.size || 20) + 4 } };
    case 'text':
      return { id: block.id, type: 'text', meta: { content: stripHtml(data.html), align: data.align || 'left', fontSize: 16 } };
    case 'image':
      return { id: block.id, type: 'image', meta: { src: data.src, alt: data.alt || '', width: '100%', align: 'center' } };
    case 'logo':
      return { id: block.id, type: 'image', meta: { src: data.src, alt: 'logo', width: data.width ? `${data.width}px` : '160px', align: 'center' } };
    case 'button':
      return { id: block.id, type: 'button', meta: { label: data.label || 'Click here', url: data.href || '#', style: data.fill === 'outline' ? 'outline' : 'solid', placement: data.align || 'center' } };
    case 'social-follow':
      return { id: block.id, type: 'social-follow', meta: { links: data.links || [], placement: 'center' } };
    case 'columns': {
      const cols = (block.children || []).filter(c => c.type === 'column').map(col => (col.children || []).flatMap(convertBlock));
      const n = cols.length || 1;
      return { id: block.id, type: 'columns', meta: { columns: n, widths: cols.map(() => Math.floor(100 / n)), blocks: cols } };
    }
    case 'section':
      return (block.children || []).flatMap(convertBlock);
    default:
      return { id: block.id || `b_${Math.random().toString(36).slice(2, 9)}`, type: 'text', meta: { content: '', align: 'left', fontSize: 16 } };
  }
}

// flatMap so a 'section' (which converts to an array of its flattened
// children) splices in correctly instead of nesting an array-in-an-array.
function convertBlocks(blocks) {
  return (blocks || []).flatMap(convertBlock);
}

// No real per-template screenshots exist yet — reusing the two generic
// placeholder images the old mock data already pointed at rather than
// leaving `src` broken.
const THUMB_A = '/uploads/annouceTemplate.png';
const THUMB_B = '/images/customDesign.png';

export const starterTemplates = [
  {
    id: 'starter_welcome',
    title: 'Welcome Email',
    tagline: 'Introduce yourself to a new subscriber',
    src: THUMB_A,
    owner: 'Fotonix',
    createdAt: null,
    blocks: convertBlocks(welcomeBlocks),
  },
  {
    id: 'starter_newsletter',
    title: 'Blog / Newsletter',
    tagline: 'Round up recent posts or updates',
    src: THUMB_B,
    owner: 'Fotonix',
    createdAt: null,
    blocks: convertBlocks(blogNewsletterBlocks),
  },
  {
    id: 'starter_explore',
    title: 'Explore / Product Roundup',
    tagline: 'Showcase a few products or features',
    src: THUMB_A,
    owner: 'Fotonix',
    createdAt: null,
    blocks: convertBlocks(exploreBlocks),
  },
  {
    id: 'starter_share_story',
    title: 'Share Your Story',
    tagline: 'A personal, narrative-style update',
    src: THUMB_B,
    owner: 'Fotonix',
    createdAt: null,
    blocks: convertBlocks(shareStoryBlocks),
  },
  {
    id: 'starter_birthday',
    title: 'Birthday / Anniversary',
    tagline: 'A celebratory one-off email',
    src: THUMB_A,
    owner: 'Fotonix',
    createdAt: null,
    blocks: convertBlocks(birthdayBlocks),
  },
  {
    id: 'starter_empty',
    title: 'Blank',
    tagline: 'Start from a single empty text block',
    src: THUMB_B,
    owner: 'Fotonix',
    createdAt: null,
    blocks: convertBlocks(emptyBlocks),
  },
];
