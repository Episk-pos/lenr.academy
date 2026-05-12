import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SortableTable from './SortableTable';
import type { TableColumn } from './SortableTable';

// Mock VirtualizedList since it uses react-virtualized
vi.mock('./VirtualizedList', () => ({
  VirtualizedList: ({ items, children }: { items: any[]; children: (item: any, meta: { index: number }) => React.ReactNode }) => (
    <div data-testid="virtualized-list">
      {items.map((item, index) => (
        <div key={index}>{children(item, { index })}</div>
      ))}
    </div>
  ),
  VirtualizedSizeReset: null,
}));

interface TestRow {
  name: string;
  value: number;
  category: string | null;
}

const columns: TableColumn<TestRow>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'value', label: 'Value', sortable: true },
  { key: 'category', label: 'Category', sortable: false },
];

const data: TestRow[] = [
  { name: 'Alpha', value: 30, category: 'A' },
  { name: 'Beta', value: 10, category: 'B' },
  { name: 'Gamma', value: 20, category: null },
];

describe('SortableTable', () => {
  it('renders column headers', () => {
    render(<SortableTable data={data} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<SortableTable data={data} columns={columns} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<SortableTable data={[]} columns={columns} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows default empty message', () => {
    render(<SortableTable data={[]} columns={columns} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('sorts ascending on first header click', () => {
    render(<SortableTable data={data} columns={columns} />);
    fireEvent.click(screen.getByText('Value'));
    const cells = screen.getAllByRole('cell');
    // After sorting by value asc: Beta(10), Gamma(20), Alpha(30)
    const values = cells.filter((_, i) => i % 3 === 1).map(c => c.textContent?.trim());
    expect(values).toEqual(['10', '20', '30']);
  });

  it('sorts descending on second header click', () => {
    render(<SortableTable data={data} columns={columns} />);
    fireEvent.click(screen.getByText('Value'));
    fireEvent.click(screen.getByText('Value'));
    const cells = screen.getAllByRole('cell');
    const values = cells.filter((_, i) => i % 3 === 1).map(c => c.textContent?.trim());
    expect(values).toEqual(['30', '20', '10']);
  });

  it('does not sort when sortable is false', () => {
    render(<SortableTable data={data} columns={columns} />);
    fireEvent.click(screen.getByText('Category'));
    // Data should remain in original order
    const cells = screen.getAllByRole('cell');
    const names = cells.filter((_, i) => i % 3 === 0).map(c => c.textContent?.trim());
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('renders null values as dash', () => {
    render(<SortableTable data={data} columns={columns} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<SortableTable data={data} columns={columns} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('renders title and description', () => {
    render(<SortableTable data={data} columns={columns} title="My Table" description="Table description" />);
    expect(screen.getByText('My Table')).toBeInTheDocument();
    expect(screen.getByText('Table description')).toBeInTheDocument();
  });

  it('renders custom cell content via render function', () => {
    const customColumns: TableColumn<TestRow>[] = [
      { key: 'name', label: 'Name', render: (val) => <strong data-testid="custom">{val}</strong> },
    ];
    render(<SortableTable data={[data[0]]} columns={customColumns} />);
    expect(screen.getByTestId('custom')).toHaveTextContent('Alpha');
  });

  it('formats numbers with locale string', () => {
    const bigData = [{ name: 'X', value: 1234567, category: 'A' }];
    render(<SortableTable data={bigData} columns={columns} />);
    // Number should be formatted with locale separators
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('has table and row roles for accessibility', () => {
    render(<SortableTable data={data} columns={columns} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(4); // 1 header + 3 data
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });

  it('shows expanded content when row clicked with renderExpandedContent', () => {
    render(
      <SortableTable
        data={data}
        columns={columns}
        renderExpandedContent={(row) => <div data-testid="expanded">Details for {row.name}</div>}
      />
    );
    fireEvent.click(screen.getByText('Alpha'));
    expect(screen.getByTestId('expanded')).toHaveTextContent('Details for Alpha');
  });

  it('shows Collapse All button when rows are expanded', () => {
    render(
      <SortableTable
        data={data}
        columns={columns}
        title="Table"
        renderExpandedContent={(row) => <div>Details for {row.name}</div>}
      />
    );
    // No collapse button initially
    expect(screen.queryByText('Collapse All')).not.toBeInTheDocument();
    // Expand a row
    fireEvent.click(screen.getByText('Alpha'));
    expect(screen.getByText('Collapse All')).toBeInTheDocument();
    // Click Collapse All
    fireEvent.click(screen.getByText('Collapse All'));
    expect(screen.queryByText('Details for Alpha')).not.toBeInTheDocument();
  });

  it('accepts className prop', () => {
    const { container } = render(<SortableTable data={data} columns={columns} className="custom-table" />);
    expect(container.querySelector('.custom-table')).toBeInTheDocument();
  });
});
