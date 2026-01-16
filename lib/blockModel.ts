// lib/blockModel.ts
// Small block model schema and helpers for editor blocks

import { v4 as uuidv4 } from 'uuid';

export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'columns' | 'spacer';

export interface BaseBlock {
  id: string;
  type: BlockType;
  meta: Record<string, any>;
  styles?: Record<string, any>;
}

export interface TextMeta {
  content: string;
  rich?: boolean;
}
export interface ImageMeta {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover';
}
export interface ButtonMeta {
  label: string;
  url: string;
  style?: { variant?: string; size?: string };
}
export interface DividerMeta {
  height: number;
  color: string;
}
export interface ColumnsMeta {
  columns: 1 | 2 | 3;
  blocks: Block[][];
}
export interface SpacerMeta {
  height: number;
}

export type Block = (
  | (BaseBlock & { type: 'text'; meta: TextMeta })
  | (BaseBlock & { type: 'image'; meta: ImageMeta })
  | (BaseBlock & { type: 'button'; meta: ButtonMeta })
  | (BaseBlock & { type: 'divider'; meta: DividerMeta })
  | (BaseBlock & { type: 'columns'; meta: ColumnsMeta })
  | (BaseBlock & { type: 'spacer'; meta: SpacerMeta })
);

// Helper: create a block with a stable uuid
export function createBlock<T extends BlockType>(type: T, initialMeta: any = {}, styles: Record<string, any> = {}): Block {
  const id = uuidv4();
  const base: BaseBlock = { id, type, meta: initialMeta, styles };
  switch (type) {
    case 'text':
      return { ...base, type: 'text', meta: { content: '', rich: false, ...(initialMeta || {}) } } as Block;
    case 'image':
      return { ...base, type: 'image', meta: { src: '', alt: '', fit: 'contain', ...(initialMeta || {}) } } as Block;
    case 'button':
      return { ...base, type: 'button', meta: { label: 'Click', url: '#', style: { variant: 'primary', size: 'md' }, ...(initialMeta || {}) } } as Block;
    case 'divider':
      return { ...base, type: 'divider', meta: { height: 1, color: '#e6e6e6', ...(initialMeta || {}) } } as Block;
    case 'columns':
      return { ...base, type: 'columns', meta: { columns: 2, blocks: (initialMeta && initialMeta.blocks) || [[], []], ...(initialMeta || {}) } } as Block;
    case 'spacer':
      return { ...base, type: 'spacer', meta: { height: 16, ...(initialMeta || {}) } } as Block;
    default:
      throw new Error('Unsupported block type: ' + type);
  }
}

// Deep clone a block and assign a new id
export function cloneBlock(block: Block): Block {
  const clone = JSON.parse(JSON.stringify(block)) as Block;
  clone.id = uuidv4();
  // For columns, regenerate ids for nested blocks too
  if (clone.type === 'columns') {
    const meta = clone.meta as ColumnsMeta;
    meta.blocks = meta.blocks.map(column => column.map(b => ({ ...b, id: uuidv4() })));
  }
  return clone;
}

export function serializeBlocks(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

export function deserializeBlocks(json: string): Block[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('Invalid blocks json');
    return parsed as Block[];
  } catch (e) {
    throw new Error('Failed to parse blocks json: ' + (e && (e as Error).message));
  }
}

// sample template containing at least one block of every type
export const sampleTemplateBlocks: Block[] = [
  createBlock('text', { content: 'Welcome to our newsletter', rich: true }, { fontSize: 22, fontWeight: 700 }),
  createBlock('image', { src: '/logo192.png', alt: 'Logo', width: 320, height: 120 }, { borderRadius: 8 }),
  createBlock('button', { label: 'Shop Now', url: 'https://example.com', style: { variant: 'primary', size: 'lg' } }, {}),
  createBlock('divider', { height: 2, color: '#333' }, {}),
  createBlock('columns', { columns: 2, blocks: [
    [ createBlock('text', { content: 'Left column content' }) ],
    [ createBlock('text', { content: 'Right column content' }) ]
  ] }, {}),
  createBlock('spacer', { height: 24 }, {})
];
