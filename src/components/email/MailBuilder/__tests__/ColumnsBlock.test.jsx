import React from 'react';
import { render, screen } from '@testing-library/react';
import BlockRenderer from '../../blocks/BlockRenderer';

describe('Columns block', () => {
  test('renders nested blocks in columns', () => {
    const columnsBlock = {
      id: 'c1', type: 'columns', meta: { columns: 2, blocks: [[{ id: 't1', type: 'text', meta: { content: 'Left' } }],[{ id: 't2', type: 'text', meta: { content: 'Right' } }]] }
    };
    const { container } = render(<BlockRenderer block={columnsBlock} onSelect={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
    expect(container).toHaveTextContent('Left');
    expect(container).toHaveTextContent('Right');
  });
});
