import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

const mockExec = vi.fn();

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({
    db: { exec: mockExec },
    isLoading: false,
    error: null,
    downloadProgress: null,
  }),
}));

vi.mock('../components/DatabaseLoadingCard', () => ({
  default: () => <div data-testid="loading-card" />,
}));

import AllTables from './AllTables';

describe('AllTables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.title)).toBeInTheDocument();
  });

  it('renders SQL editor section', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.sqlEditor)).toBeInTheDocument();
  });

  it('renders default query in textarea', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    expect(textarea).toBeInTheDocument();
  });

  it('renders execute button', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.executeQuery)).toBeInTheDocument();
  });

  it('renders clear button', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.clear)).toBeInTheDocument();
  });

  it('renders example queries', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.exampleQueries)).toBeInTheDocument();
    // Should have at least one example query
    expect(screen.getByText(/SELECT \* FROM NuclidesPlus/)).toBeInTheDocument();
  });

  it('renders available tables list', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.availableTables)).toBeInTheDocument();
    expect(screen.getByText('FusionAll')).toBeInTheDocument();
    expect(screen.getByText('FissionAll')).toBeInTheDocument();
  });

  it('renders SQL tips', () => {
    render(<AllTables />);
    expect(screen.getByText(en.allTables.sqlTips)).toBeInTheDocument();
  });

  it('executes query when button clicked', () => {
    mockExec.mockReturnValue([{
      columns: ['Z', 'A', 'MeV'],
      values: [[1, 1, 10.5]],
    }]);
    render(<AllTables />);
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(mockExec).toHaveBeenCalled();
  });

  it('shows error for destructive queries', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'DROP TABLE FusionAll' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
  });

  it('clears query when clear button clicked', () => {
    render(<AllTables />);
    fireEvent.click(screen.getByText(en.allTables.clear));
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('loads example query when clicked', () => {
    render(<AllTables />);
    const exampleBtn = screen.getByText(/SELECT \* FROM NuclidesPlus/);
    fireEvent.click(exampleBtn);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder) as HTMLTextAreaElement;
    expect(textarea.value).toContain('NuclidesPlus');
  });

  it('shows query results after execution', () => {
    mockExec.mockReturnValue([{
      columns: ['Z', 'A', 'MeV'],
      values: [[1, 1, 10.5], [2, 4, 20.3]],
    }]);
    render(<AllTables />);
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    // Should show export button (proves results rendered)
    expect(screen.getByText(en.allTables.exportCsv)).toBeInTheDocument();
    // Should show column headers
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('MeV')).toBeInTheDocument();
  });

  it('shows error message on query failure', () => {
    mockExec.mockImplementation(() => { throw new Error('syntax error'); });
    render(<AllTables />);
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText('syntax error')).toBeInTheDocument();
  });

  it('blocks DELETE statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'DELETE FROM FusionAll' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks INSERT statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: "INSERT INTO NuclidesPlus VALUES (1,1,'H',1)" } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks UPDATE statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: "UPDATE NuclidesPlus SET Z=999 WHERE E='H'" } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks ALTER TABLE statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'ALTER TABLE NuclidesPlus ADD COLUMN foo TEXT' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks CREATE TABLE statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'CREATE TABLE evil (id INTEGER)' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks WITH...DELETE bypass attempts', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'WITH x AS (SELECT 1) DELETE FROM NuclidesPlus' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks ATTACH DATABASE statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: "ATTACH DATABASE '/etc/passwd' AS steal" } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('blocks VACUUM statements', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'VACUUM' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(screen.getByText(en.allTables.readOnlyError)).toBeInTheDocument();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('allows EXPLAIN SELECT queries', () => {
    mockExec.mockReturnValue([{
      columns: ['addr', 'opcode', 'p1'],
      values: [[0, 'Init', 0]],
    }]);
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'EXPLAIN SELECT * FROM NuclidesPlus LIMIT 1' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(mockExec).toHaveBeenCalled();
  });

  it('allows WITH (CTE) SELECT queries', () => {
    mockExec.mockReturnValue([{
      columns: ['Z'],
      values: [[1]],
    }]);
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: 'WITH cte AS (SELECT Z FROM NuclidesPlus) SELECT * FROM cte' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(mockExec).toHaveBeenCalled();
  });

  it('strips SQL comments before validation', () => {
    mockExec.mockReturnValue([{
      columns: ['Z'],
      values: [[1]],
    }]);
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: '-- This is a comment\nSELECT Z FROM NuclidesPlus LIMIT 1' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(mockExec).toHaveBeenCalled();
  });

  it('does nothing when query is empty', () => {
    render(<AllTables />);
    const textarea = screen.getByPlaceholderText(en.allTables.queryPlaceholder);
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.click(screen.getByText(en.allTables.executeQuery));
    expect(mockExec).not.toHaveBeenCalled();
  });
});
