import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header with Affiliates link', () => {
  render(<App />);
  const linkElement = screen.getByText(/Affiliates/i);
  expect(linkElement).toBeInTheDocument();
});
