import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import ExportMenu from './ExportMenu';

function setup(disabled = false) {
  const onCsv = vi.fn();
  const onJson = vi.fn();
  const onPdf = vi.fn();
  render(
    <div>
      <button>outside</button>
      <ExportMenu
        disabled={disabled}
        items={[
          { key: 'csv', label: 'Export CSV', onSelect: onCsv },
          { key: 'json', label: 'Export JSON', onSelect: onJson },
          { key: 'pdf', label: 'Export PDF', onSelect: onPdf },
        ]}
      />
    </div>,
  );
  const trigger = screen.getByRole('button', { name: 'Export' });
  return { trigger, onCsv, onJson, onPdf };
}

describe('ExportMenu', () => {
  it('renders a collapsed menu button', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click and invokes the selected handler, then closes', () => {
    const { trigger, onJson, onCsv } = setup();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);

    fireEvent.click(screen.getByRole('menuitem', { name: /Export JSON/ }));
    expect(onJson).toHaveBeenCalledTimes(1);
    expect(onCsv).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on outside click', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('supports arrow key / Home / End navigation with wrap-around', () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'End' });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(items[2], { key: 'ArrowDown' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(items[2], { key: 'Home' });
    expect(items[0]).toHaveFocus();
  });

  it('opens with ArrowUp focusing the last item', () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    const items = screen.getAllByRole('menuitem');
    expect(items[2]).toHaveFocus();
  });

  it('is disabled when requested', () => {
    const { trigger } = setup(true);
    expect(trigger).toBeDisabled();
  });
});
