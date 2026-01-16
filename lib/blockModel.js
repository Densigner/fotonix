const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {'text'|'image'|'button'|'divider'|'columns'|'spacer'} BlockType
 */

/**
 * @typedef {Object} BaseBlock
 * @property {string} id
 * @property {BlockType} type
 * @property {Object} meta
 * @property {Object} [styles]
 */

/**
 * @typedef {Object} TextMeta
 * @property {string} content
 * @property {boolean} [rich]
 */

/**
 * @typedef {Object} ImageMeta
 * @property {string} src
 * @property {string} [alt]
 * @property {number} [width]
 * @property {number} [height]
 * @property {'contain'|'cover'} [fit]
 */

/**
 * @typedef {Object} ButtonMeta
 * @property {string} label
 * @property {string} url
 * @property {Object} [style]
 * @property {string} [style.variant]
 * @property {string} [style.size]
 */

/**
 * @typedef {Object} DividerMeta
 * @property {number} height
 * @property {string} color
 */

/**
 * @typedef {Object} ColumnsMeta
 * @property {1|2|3} columns
 * @property {Array<Array<BaseBlock>>} blocks
 */

/**
 * @typedef {Object} SpacerMeta
 * @property {number} height
 */

/**
 * @typedef {BaseBlock & {type: 'text', meta: TextMeta} | BaseBlock & {type: 'image', meta: ImageMeta} | BaseBlock & {type: 'button', meta: ButtonMeta} | BaseBlock & {type: 'divider', meta: DividerMeta} | BaseBlock & {type: 'columns', meta: ColumnsMeta} | BaseBlock & {type: 'spacer', meta: SpacerMeta}} Block
 */

/**
 * Create a block with a new UUID
 * @param {BlockType} type
 * @param {Object} [initialMeta]
 * @param {Object} [styles]
 * @returns {Block}
 */
function createBlock(type, initialMeta = {}, styles = {}) {
  const id = uuidv4();
  const base = { id, type, meta: initialMeta, styles };
  switch (type) {
    case 'text':
      return Object.assign({}, base, { type: 'text', meta: Object.assign({ content: '', rich: false }, initialMeta) });
    case 'image':
      return Object.assign({}, base, { type: 'image', meta: Object.assign({ src: '', alt: '', fit: 'contain' }, initialMeta) });
    case 'button':
      return Object.assign({}, base, { type: 'button', meta: Object.assign({ label: 'Click', url: '#', style: { variant: 'primary', size: 'md' } }, initialMeta) });
    case 'divider':
      return Object.assign({}, base, { type: 'divider', meta: Object.assign({ height: 1, color: '#e6e6e6' }, initialMeta) });
    case 'columns': {
      const blocks = (initialMeta && initialMeta.blocks) || [[], []];
      return Object.assign({}, base, { type: 'columns', meta: Object.assign({ columns: 2, blocks }, initialMeta) });
    }
    case 'spacer':
      return Object.assign({}, base, { type: 'spacer', meta: Object.assign({ height: 16 }, initialMeta) });
    default:
      throw new Error('Unsupported block type: ' + type);
  }
}

/**
 * Deep clone a block and assign a new id. For columns, nested blocks will also get new ids.
 * @param {Block} block
 * @returns {Block}
 */
function cloneBlock(block) {
  const clone = JSON.parse(JSON.stringify(block));
  clone.id = uuidv4();
  if (clone.type === 'columns' && clone.meta && Array.isArray(clone.meta.blocks)) {
    clone.meta.blocks = clone.meta.blocks.map(column => column.map(b => Object.assign({}, b, { id: uuidv4() })));
  }
  return clone;
}

/**
 * Serialize blocks to JSON
 * @param {Block[]} blocks
 * @returns {string}
 */
function serializeBlocks(blocks) {
  return JSON.stringify(blocks);
}

/**
 * Deserialize JSON to blocks
 * @param {string} json
 * @returns {Block[]}
 */
function deserializeBlocks(json) {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('Invalid blocks json');
    return parsed;
  } catch (e) {
    throw new Error('Failed to parse blocks json: ' + (e && e.message));
  }
}

// sample template containing at least one block of every type
const sampleTemplateBlocks = [
  createBlock('text', { content: 'Welcome to our newsletter', rich: true }, { fontSize: 22, fontWeight: 700 }),
  createBlock('image', { src: '/logo192.png', alt: 'Logo', width: 320, height: 120 }),
  createBlock('button', { label: 'Shop Now', url: 'https://example.com', style: { variant: 'primary', size: 'lg' } }),
  createBlock('divider', { height: 2, color: '#333' }),
  createBlock('columns', { columns: 2, blocks: [
    [ createBlock('text', { content: 'Left column content' }) ],
    [ createBlock('text', { content: 'Right column content' }) ]
  ] }),
  createBlock('spacer', { height: 24 })
];

module.exports = {
  createBlock,
  cloneBlock,
  serializeBlocks,
  deserializeBlocks,
  sampleTemplateBlocks
};
