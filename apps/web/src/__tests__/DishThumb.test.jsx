import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DishThumb from '../components/DishThumb.jsx';

describe('DishThumb', () => {
  it('renders an image with the dish name as alt text', () => {
    render(<DishThumb src='https://cdn.test/paneer.jpg' name='Paneer Tikka' />);
    const img = screen.getByAltText('Paneer Tikka');
    expect(img).toHaveAttribute('src', 'https://cdn.test/paneer.jpg');
  });

  it('renders the fallback block when no image is available', () => {
    const { container } = render(<DishThumb src='' name='Paneer Tikka' />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('switches to the fallback when the image fails to load', () => {
    render(<DishThumb src='https://cdn.test/broken.jpg' name='Paneer Tikka' />);
    const img = screen.getByAltText('Paneer Tikka');
    fireEvent.error(img);
    expect(screen.queryByAltText('Paneer Tikka')).not.toBeInTheDocument();
  });
});
