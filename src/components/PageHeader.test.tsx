import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';
import { PAGE_ICONS } from '../constants/pageIcons';

describe('PageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<PageHeader icon={PAGE_ICONS.fusion} title="Fusion Reactions" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Fusion Reactions' })).toBeInTheDocument();
  });

  it('renders the icon as decorative (aria-hidden) svg', () => {
    const { container } = render(<PageHeader icon={PAGE_ICONS.help} title="Help" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.getAttribute('class')).toMatch(/dark:text-primary-400/);
  });

  it('renders subtitle when provided and omits it otherwise', () => {
    const { rerender, container } = render(
      <PageHeader icon={PAGE_ICONS.help} title="Help" subtitle="Find answers" />
    );
    expect(screen.getByText('Find answers')).toBeInTheDocument();
    rerender(<PageHeader icon={PAGE_ICONS.help} title="Help" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders actions slot', () => {
    render(
      <PageHeader icon={PAGE_ICONS.fusion} title="Fusion" actions={<button>History</button>} />
    );
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
  });

  it('forwards titleTestId to the h1 and applies className to the wrapper', () => {
    render(
      <PageHeader
        icon={PAGE_ICONS.transmutations}
        title="Transmutations"
        titleTestId="transmutations-heading"
        className="mb-8"
      />
    );
    expect(screen.getByTestId('transmutations-heading').tagName).toBe('H1');
    expect(screen.getByTestId('page-header').className).toMatch(/\bmb-8\b/);
  });
});
