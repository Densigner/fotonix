// Real starter templates for the "New Campaign" landing screen
// (src/components/automationscomposer/AutomationsEditor.js). These block
// designs already existed (welcomePreset.js etc.) but were never imported
// anywhere — the landing screen instead showed either leftover browser-local
// test junk or two hardcoded mock placeholders (see gotchas.md). This file
// is the single place that turns the existing preset block-arrays into
// real, selectable templates.
import { welcomeBlocks } from './welcomePreset';
import { emptyBlocks } from './emptyPreset';
import { birthdayBlocks } from './birthdayPreset';
import { blogNewsletterBlocks } from './blogNewsletterPreset';
import { exploreBlocks } from './explorePreset';
import { shareStoryBlocks } from './shareStoryPreset';

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
    blocks: welcomeBlocks,
  },
  {
    id: 'starter_newsletter',
    title: 'Blog / Newsletter',
    tagline: 'Round up recent posts or updates',
    src: THUMB_B,
    owner: 'Fotonix',
    createdAt: null,
    blocks: blogNewsletterBlocks,
  },
  {
    id: 'starter_explore',
    title: 'Explore / Product Roundup',
    tagline: 'Showcase a few products or features',
    src: THUMB_A,
    owner: 'Fotonix',
    createdAt: null,
    blocks: exploreBlocks,
  },
  {
    id: 'starter_share_story',
    title: 'Share Your Story',
    tagline: 'A personal, narrative-style update',
    src: THUMB_B,
    owner: 'Fotonix',
    createdAt: null,
    blocks: shareStoryBlocks,
  },
  {
    id: 'starter_birthday',
    title: 'Birthday / Anniversary',
    tagline: 'A celebratory one-off email',
    src: THUMB_A,
    owner: 'Fotonix',
    createdAt: null,
    blocks: birthdayBlocks,
  },
  {
    id: 'starter_empty',
    title: 'Blank',
    tagline: 'Start from a single empty text block',
    src: THUMB_B,
    owner: 'Fotonix',
    createdAt: null,
    blocks: emptyBlocks,
  },
];
