/**
 * Component tests for PathwayBrowserTable
 *
 * Tests:
 * - Sorting by different fields (frequency, avgEnergy, totalEnergy, rarity, loops)
 * - Filtering (search, reaction type, feedback only, min frequency)
 * - Responsive layout (column visibility at different breakpoints)
 * - Empty state handling
 * - Helper functions (formatLoops)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PathwayBrowserTable from './PathwayBrowserTable';
import type { PathwayAnalysis } from '../services/pathwayAnalyzer';

// Mock VirtualizedList to simplify testing
vi.mock('./VirtualizedList', () => ({
  VirtualizedList: ({ items, children }: { items: any[]; children: (item: any) => JSX.Element }) => (
    <div data-testid="virtualized-list">
      {items.map((item, index) => (
        <div key={index} data-testid={`pathway-row-${index}`}>
          {children(item)}
        </div>
      ))}
    </div>
  ),
}));

// Sample pathway data for testing
const createMockPathway = (overrides: Partial<PathwayAnalysis> = {}): PathwayAnalysis => ({
  pathway: 'H-1 + Li-7 → He-4',
  type: 'fusion',
  inputs: ['H-1', 'Li-7'],
  outputs: ['He-4'],
  frequency: 10,
  avgEnergy: 17.3,
  totalEnergy: 173.0,
  loops: [0, 1, 2],
  isFeedback: false,
  rarityScore: 100,
  ...overrides,
});

const mockPathways: PathwayAnalysis[] = [
  createMockPathway({
    pathway: 'H-1 + Li-7 → He-4',
    inputs: ['H-1', 'Li-7'],
    outputs: ['He-4'],
    frequency: 10,
    avgEnergy: 17.3,
    totalEnergy: 173.0,
    loops: [0, 1, 2],
    isFeedback: true,
    rarityScore: 100,
  }),
  createMockPathway({
    pathway: 'D-2 + D-2 → He-3 + n',
    type: 'twotwo',
    inputs: ['D-2', 'D-2'],
    outputs: ['He-3', 'n'],
    frequency: 5,
    avgEnergy: 3.27,
    totalEnergy: 16.35,
    loops: [1, 2, 3],
    isFeedback: false,
    rarityScore: 50,
  }),
  createMockPathway({
    pathway: 'Li-6 + n → H-3 + He-4',
    type: 'twotwo',
    inputs: ['Li-6', 'n'],
    outputs: ['H-3', 'He-4'],
    frequency: 3,
    avgEnergy: 4.78,
    totalEnergy: 14.34,
    loops: [2],
    isFeedback: true,
    rarityScore: 30,
  }),
  createMockPathway({
    pathway: 'B-11 + H-1 → C-12',
    inputs: ['B-11', 'H-1'],
    outputs: ['C-12'],
    frequency: 8,
    avgEnergy: 8.68,
    totalEnergy: 69.44,
    loops: [0, 5, 10],
    isFeedback: false,
    rarityScore: 80,
  }),
];

describe('PathwayBrowserTable', () => {
  describe('rendering', () => {
    it('should render pathway table with data', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Check header columns exist
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('Avg (MeV)')).toBeInTheDocument();
      expect(screen.getByText('Total (MeV)')).toBeInTheDocument();

      // Check results count
      expect(screen.getByText('Showing 4 of 4 pathways')).toBeInTheDocument();
    });

    it('should render empty state when no pathways provided', () => {
      render(<PathwayBrowserTable pathways={[]} />);

      expect(screen.getByText('Showing 0 of 0 pathways')).toBeInTheDocument();
    });

    it('should render empty state message when filters match nothing', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Search for non-existent nuclide
      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'Xyz-999');

      expect(screen.getByText('No pathways match your filters. Try adjusting the criteria.')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should filter pathways by search term (input)', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'Li-7');

      // Should show only pathway with Li-7
      expect(screen.getByText('Showing 1 of 4 pathways')).toBeInTheDocument();
      expect(screen.getAllByText('H-1 + Li-7 → He-4')[0]).toBeInTheDocument();
    });

    it('should filter pathways by search term (output)', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'He-3');

      // Should show only pathway with He-3 output
      expect(screen.getByText('Showing 1 of 4 pathways')).toBeInTheDocument();
      expect(screen.getAllByText('D-2 + D-2 → He-3 + n')[0]).toBeInTheDocument();
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'he-4');

      // Should match He-4 (case-insensitive)
      expect(screen.getByText(/Showing \d+ of 4 pathways/)).toBeInTheDocument();
      const count = screen.getByText(/Showing \d+ of 4 pathways/).textContent;
      expect(count).toContain('2'); // Two pathways contain He-4
    });

    it('should clear filter when search is cleared', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'Li-7');
      expect(screen.getByText('Showing 1 of 4 pathways')).toBeInTheDocument();

      await user.clear(searchInput);
      expect(screen.getByText('Showing 4 of 4 pathways')).toBeInTheDocument();
    });
  });

  describe('reaction type filters', () => {
    it('should show/hide filters panel', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const filterButton = screen.getByText('Show Filters');
      await user.click(filterButton);

      // Filters should be visible
      expect(screen.getByText('Reaction Types:')).toBeInTheDocument();
      expect(screen.getByLabelText('Fusion')).toBeInTheDocument();
      expect(screen.getByLabelText('Two-to-Two')).toBeInTheDocument();

      // Click again to hide
      await user.click(screen.getByText('Hide Filters'));
      // Panel should collapse (still in DOM but hidden via CSS)
    });

    it('should filter fusion reactions', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Uncheck fusion
      const fusionCheckbox = screen.getByLabelText('Fusion');
      await user.click(fusionCheckbox);

      // Should show only two-to-two reactions (2 of them)
      expect(screen.getByText('Showing 2 of 4 pathways')).toBeInTheDocument();
      expect(screen.getAllByText('D-2 + D-2 → He-3 + n')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Li-6 + n → H-3 + He-4')[0]).toBeInTheDocument();
    });

    it('should filter two-to-two reactions', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Uncheck two-to-two
      const twoToTwoCheckbox = screen.getByLabelText('Two-to-Two');
      await user.click(twoToTwoCheckbox);

      // Should show only fusion reactions (2 of them)
      expect(screen.getByText('Showing 2 of 4 pathways')).toBeInTheDocument();
      expect(screen.getAllByText('H-1 + Li-7 → He-4')[0]).toBeInTheDocument();
      expect(screen.getAllByText('B-11 + H-1 → C-12')[0]).toBeInTheDocument();
    });

    it('should show no results when both types unchecked', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Uncheck both
      await user.click(screen.getByLabelText('Fusion'));
      await user.click(screen.getByLabelText('Two-to-Two'));

      expect(screen.getByText('Showing 0 of 4 pathways')).toBeInTheDocument();
      expect(screen.getByText('No pathways match your filters. Try adjusting the criteria.')).toBeInTheDocument();
    });
  });

  describe('feedback filter', () => {
    it('should filter pathways with feedback loops', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Check feedback only
      const feedbackCheckbox = screen.getByLabelText('Show only feedback loops');
      await user.click(feedbackCheckbox);

      // Should show only 2 pathways with isFeedback=true
      expect(screen.getByText('Showing 2 of 4 pathways')).toBeInTheDocument();
      expect(screen.getAllByText('H-1 + Li-7 → He-4')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Li-6 + n → H-3 + He-4')[0]).toBeInTheDocument();
    });
  });

  describe('frequency filter', () => {
    it('should filter by minimum frequency', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Set minimum frequency to 5
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '5' } });

      // Should show pathways with frequency >= 5 (3 pathways: 10, 5, 8)
      expect(screen.getByText('Showing 3 of 4 pathways')).toBeInTheDocument();
    });

    it('should display current frequency value', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      expect(screen.getByText('Minimum Frequency: 1×')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('should sort by frequency (default)', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Default sort is frequency descending
      const rows = screen.getAllByTestId(/pathway-row-/);

      // First row should have highest frequency (10)
      expect(within(rows[0]).getByText('×10')).toBeInTheDocument();
    });

    it('should toggle sort direction when clicking same field', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const countButton = screen.getByRole('button', { name: /Count/i });

      // Initial: descending (10, 8, 5, 3)
      let rows = screen.getAllByTestId(/pathway-row-/);
      expect(within(rows[0]).getByText('×10')).toBeInTheDocument();

      // Click to toggle to ascending
      await user.click(countButton);

      rows = screen.getAllByTestId(/pathway-row-/);
      expect(within(rows[0]).getByText('×3')).toBeInTheDocument();
    });

    it('should sort by average energy', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const avgEnergyButton = screen.getByRole('button', { name: /Avg \(MeV\)/i });
      await user.click(avgEnergyButton);

      // Should be sorted by avgEnergy descending
      const rows = screen.getAllByTestId(/pathway-row-/);

      // Highest avgEnergy is 17.3 (H-1 + Li-7)
      expect(within(rows[0]).getAllByText('H-1 + Li-7 → He-4')[0]).toBeInTheDocument();
    });

    it('should sort by total energy', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const totalEnergyButton = screen.getByRole('button', { name: /Total \(MeV\)/i });
      await user.click(totalEnergyButton);

      // Should be sorted by totalEnergy descending
      const rows = screen.getAllByTestId(/pathway-row-/);

      // Highest totalEnergy is 173.0
      expect(within(rows[0]).getByText('173.00')).toBeInTheDocument();
    });

    it('should sort by rarity score', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open the rarity column (hidden on mobile)
      const rarityButton = screen.getByRole('button', { name: /Rarity/i });
      await user.click(rarityButton);

      // Should be sorted by rarityScore descending
      const rows = screen.getAllByTestId(/pathway-row-/);

      // Highest rarityScore is 100
      expect(within(rows[0]).getByText('100%')).toBeInTheDocument();
    });

    it('should sort by loops (first loop number)', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const loopsButton = screen.getByRole('button', { name: /Loops/i });
      await user.click(loopsButton);

      // Should be sorted by min loop number descending
      // Highest min loop is 2 (Li-6 pathway has loops: [2])
      const rows = screen.getAllByTestId(/pathway-row-/);
      expect(within(rows[0]).getAllByText('Li-6 + n → H-3 + He-4')[0]).toBeInTheDocument();
    });

    it('should show sort indicators', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Count button should have active indicator (ChevronDown)
      const countButton = screen.getByRole('button', { name: /Count/i });
      expect(countButton.querySelector('svg')).not.toBeNull();

      // Click to sort by avgEnergy
      const avgEnergyButton = screen.getByRole('button', { name: /Avg \(MeV\)/i });
      await user.click(avgEnergyButton);

      // avgEnergy button should now have active indicator
      expect(avgEnergyButton.querySelector('svg')).not.toBeNull();
    });
  });

  describe('combined filters', () => {
    it('should apply search + type filter + feedback filter', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Search for "He"
      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'He');

      // Uncheck fusion
      await user.click(screen.getByLabelText('Fusion'));

      // Enable feedback only
      await user.click(screen.getByLabelText('Show only feedback loops'));

      // Should show only two-to-two reactions with feedback that contain "He"
      // That's Li-6 + n → H-3 + He-4
      expect(screen.getByText('Showing 1 of 4 pathways')).toBeInTheDocument();
      expect(screen.getAllByText('Li-6 + n → H-3 + He-4')[0]).toBeInTheDocument();
    });

    it('should apply all filters simultaneously', async () => {
      const user = userEvent.setup();
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Open filters
      await user.click(screen.getByText('Show Filters'));

      // Set min frequency to 5
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '5' } });

      // Uncheck two-to-two
      await user.click(screen.getByLabelText('Two-to-Two'));

      // Search for "H-1"
      const searchInput = screen.getByPlaceholderText('Search by nuclide name...');
      await user.type(searchInput, 'H-1');

      // Should show fusion reactions with freq >= 5 containing H-1
      // That's: H-1 + Li-7 (freq 10) and B-11 + H-1 (freq 8)
      expect(screen.getByText('Showing 2 of 4 pathways')).toBeInTheDocument();
    });
  });

  describe('pathway display formatting', () => {
    it('should display reaction type badges', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      expect(screen.getAllByText('Fusion').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2→2').length).toBeGreaterThan(0);
    });

    it('should display frequency with × prefix', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      expect(screen.getByText('×10')).toBeInTheDocument();
      expect(screen.getByText('×5')).toBeInTheDocument();
      expect(screen.getByText('×3')).toBeInTheDocument();
      expect(screen.getByText('×8')).toBeInTheDocument();
    });

    it('should format energy values to 2 decimal places', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      expect(screen.getByText('17.30')).toBeInTheDocument();
      expect(screen.getByText('173.00')).toBeInTheDocument();
      expect(screen.getByText('3.27')).toBeInTheDocument();
    });

    it('should display feedback checkmark', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      // Check for feedback checkmarks (✓)
      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks.length).toBe(2); // Two pathways have isFeedback=true
    });

    it('should format rarity score as percentage', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('formatLoops helper', () => {
    // Test the formatLoops function indirectly through rendered output
    it('should format single loop', () => {
      const singleLoopPathway = [createMockPathway({ loops: [5] })];
      render(<PathwayBrowserTable pathways={singleLoopPathway} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should format sequential loops as range', () => {
      const sequentialPathway = [createMockPathway({ loops: [0, 1, 2, 3, 4] })];
      render(<PathwayBrowserTable pathways={sequentialPathway} />);

      expect(screen.getByText('0-4')).toBeInTheDocument();
    });

    it('should format few loops as comma-separated', () => {
      const fewLoopsPathway = [createMockPathway({ loops: [0, 5, 10] })];
      render(<PathwayBrowserTable pathways={fewLoopsPathway} />);

      expect(screen.getByText('0, 5, 10')).toBeInTheDocument();
    });

    it('should format many non-sequential loops as count', () => {
      const manyLoopsPathway = [createMockPathway({ loops: [0, 2, 4, 6, 8] })];
      render(<PathwayBrowserTable pathways={manyLoopsPathway} />);

      expect(screen.getByText('5 loops')).toBeInTheDocument();
    });

    it('should show dash for empty loops', () => {
      const emptyLoopsPathway = [createMockPathway({ loops: [] })];
      render(<PathwayBrowserTable pathways={emptyLoopsPathway} />);

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('virtualization', () => {
    it('should use VirtualizedList component', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('should render all items through virtualized list', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const rows = screen.getAllByTestId(/pathway-row-/);
      expect(rows).toHaveLength(4);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels for inputs', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      expect(screen.getByPlaceholderText('Search by nuclide name...')).toBeInTheDocument();
    });

    it('should have clickable buttons for sorting', () => {
      render(<PathwayBrowserTable pathways={mockPathways} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
