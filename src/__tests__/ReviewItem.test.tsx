/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewItem, { saveHelpfulVote } from '../../components/ReviewItem';

jest.mock('../../components/ReviewItem', () => {
  const original = jest.requireActual('../../components/ReviewItem');
  return {
    ...original,
    saveHelpfulVote: jest.fn(async (id: string, vote: any) => {
      if (id === 'fail') throw new Error('network');
      if (vote === 'up') return { helpfulUp: 1, helpfulDown: 0 };
      if (vote === 'down') return { helpfulUp: 0, helpfulDown: 1 };
      return { helpfulUp: 0, helpfulDown: 0 };
    }),
  };
});

const sample = {
  id: 'r1', name: 'Alice', title: 'Great', body: 'Loved it', rating: 5, date: new Date().toISOString(), verified: true, helpfulUp: 0, helpfulDown: 0
};

describe('ReviewItem', () => {
  beforeEach(() => localStorage.clear());

  test('renders counts and buttons', () => {
    render(<ReviewItem review={sample as any} />);
    expect(screen.getByText(/0 found this helpful/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Helpful up/ })).toBeInTheDocument();
  });

  test('upvote increments then second click clears', async () => {
    render(<ReviewItem review={sample as any} />);
    const up = screen.getByRole('button', { name: /Helpful up/ });
    fireEvent.click(up);
    await waitFor(() => expect(up).toHaveTextContent('👍 1'));
    fireEvent.click(up);
    await waitFor(() => expect(up).toHaveTextContent('👍 0'));
  });

  test('switching from up to down updates counts', async () => {
    render(<ReviewItem review={sample as any} />);
    const up = screen.getByRole('button', { name: /Helpful up/ });
    const down = screen.getByRole('button', { name: /Helpful down/ });
    fireEvent.click(up);
    await waitFor(() => expect(up).toHaveTextContent('👍 1'));
    fireEvent.click(down);
    await waitFor(() => expect(down).toHaveTextContent('👎 1'));
  });

  test('optimistic update then rollback on error', async () => {
    render(<ReviewItem review={{ ...sample, id: 'fail' } as any} />);
    const up = screen.getByRole('button', { name: /Helpful up/ });
    fireEvent.click(up);
    // optimistic shows 1
    expect(up).toHaveTextContent('👍 1');
    // after reconcile it should rollback to 0
    await waitFor(() => expect(up).toHaveTextContent('👍 0'));
  });

  test('persists vote in localStorage', async () => {
    render(<ReviewItem review={sample as any} />);
    const up = screen.getByRole('button', { name: /Helpful up/ });
    fireEvent.click(up);
    await waitFor(() => expect(localStorage.getItem('rv-helpful-r1')).toBe('up'));
  });
});
