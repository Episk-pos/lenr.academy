import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-virtualized
vi.mock('react-virtualized', () => ({
  AutoSizer: ({ children }: { children: (size: { width: number; height: number }) => React.ReactNode }) => (
    <div data-testid="auto-sizer">{children({ width: 800, height: 600 })}</div>
  ),
  List: vi.fn(({ rowCount, rowRenderer, height, width, 'aria-label': ariaLabel }: any) => (
    <div data-testid="virtual-list" aria-label={ariaLabel} style={{ height, width }}>
      {Array.from({ length: Math.min(rowCount, 10) }, (_, index) =>
        rowRenderer({ index, key: `row-${index}`, parent: {}, style: {} })
      )}
    </div>
  )),
  CellMeasurer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CellMeasurerCache: class {
    clearAll = vi.fn();
    clear = vi.fn();
    rowHeight = vi.fn(() => 72);
  },
}));

import { VirtualizedList } from './VirtualizedList';

describe('VirtualizedList', () => {
  const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];

  it('renders items using children render function', () => {
    render(
      <VirtualizedList items={items} height={400}>
        {(item) => <div>{item}</div>}
      </VirtualizedList>
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <VirtualizedList items={items} height={400} className="my-list">
        {(item) => <div>{item}</div>}
      </VirtualizedList>
    );
    const listDiv = container.firstChild as HTMLElement;
    expect(listDiv.className).toContain('virtualized-list');
    expect(listDiv.className).toContain('my-list');
  });

  it('renders with ariaLabel', () => {
    render(
      <VirtualizedList items={items} height={400} ariaLabel="My items list">
        {(item) => <div>{item}</div>}
      </VirtualizedList>
    );
    expect(screen.getByLabelText('My items list')).toBeInTheDocument();
  });

  it('sets container height via style', () => {
    const { container } = render(
      <VirtualizedList items={items} height={500}>
        {(item) => <div>{item}</div>}
      </VirtualizedList>
    );
    const listDiv = container.firstChild as HTMLElement;
    expect(listDiv.style.height).toBe('500px');
  });

  it('provides index to children render function', () => {
    render(
      <VirtualizedList items={items} height={400}>
        {(item, { index }) => <div>{`${index}: ${item}`}</div>}
      </VirtualizedList>
    );
    expect(screen.getByText('0: Apple')).toBeInTheDocument();
    expect(screen.getByText('2: Cherry')).toBeInTheDocument();
  });

  it('renders empty list', () => {
    render(
      <VirtualizedList items={[]} height={400}>
        {(item: string) => <div>{item}</div>}
      </VirtualizedList>
    );
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });

  it('calls onRegisterSizeReset when provided', () => {
    const onRegisterSizeReset = vi.fn();
    render(
      <VirtualizedList items={items} height={400} onRegisterSizeReset={onRegisterSizeReset}>
        {(item) => <div>{item}</div>}
      </VirtualizedList>
    );
    expect(onRegisterSizeReset).toHaveBeenCalledWith(expect.any(Function));
  });
});
