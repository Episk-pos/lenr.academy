import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

// Minimal schema mirroring the real parkhomov.db column names
const mockSchema: Record<string, string[]> = {
  FusionAll: ['id', 'neutrino', 'id_sub', 'E1', 'A1', 'nBorF1', 'Z1', 'aBorF1', 'E2', 'A2', 'nBorF2', 'Z2', 'aBorF2', 'E', 'A', 'nBorF', 'Z', 'aBorF', 'MeV'],
  AtomicRadii: ['Z', 'E', 'EName', 'AtRadEmpirical', 'AtRadCalculated', 'AtRadVanDerWaals', 'AtRadCovalent'],
  RadioNuclides: ['id', 'A', 'E', 'Z', 'RDM', 'HL', 'Units', 'LHL', 'RT', 'DEKeV', 'RI'],
};

const mockExec = vi.fn((sql: string) => {
  const match = sql.match(/PRAGMA table_info\((\w+)\)/);
  const cols = match ? mockSchema[match[1]] : undefined;
  if (!cols) return [];
  return [{
    columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
    values: cols.map((c, i) => [i, c, 'TEXT', 0, null, 0]),
  }];
});

let mockDb: { exec: typeof mockExec } | null = { exec: mockExec };

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: mockDb, isLoading: false, error: null, downloadProgress: null }),
}));

import TablesInDetail from './TablesInDetail';

describe('TablesInDetail', () => {
  it('renders page title', () => {
    render(<TablesInDetail />);
    expect(screen.getByText(en.tables.title)).toBeInTheDocument();
  });

  it('renders all database tables', () => {
    mockDb = { exec: mockExec };
    render(<TablesInDetail />);
    for (const name of ['FusionAll', 'FissionAll', 'TwoToTwoAll', 'NuclidesPlus', 'ElementPropertiesPlus', 'AtomicRadii', 'RadioNuclides', 'ElementsPlus']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('derives field codes from the database schema', () => {
    mockDb = { exec: mockExec };
    render(<TablesInDetail />);
    expect(mockExec).toHaveBeenCalledWith('PRAGMA table_info(FusionAll)');
    // FusionAll second-reactant columns come from the schema
    expect(screen.getByText('E2')).toBeInTheDocument();
    expect(screen.getByText('nBorF2')).toBeInTheDocument();
    expect(screen.getAllByText('MeV').length).toBeGreaterThanOrEqual(1);
    // Columns from previously undocumented tables
    expect(screen.getByText('AtRadCovalent')).toBeInTheDocument();
    expect(screen.getByText('DEKeV')).toBeInTheDocument();
    // BEin was listed by the old hardcoded schema but doesn't exist in the DB
    expect(screen.queryByText('BEin')).not.toBeInTheDocument();
  });

  it('shows loading placeholder when the database is not loaded', () => {
    mockDb = null;
    render(<TablesInDetail />);
    expect(screen.getAllByText(en.common.loading).length).toBe(8);
    mockDb = { exec: mockExec };
  });

  it('renders field definitions section', () => {
    render(<TablesInDetail />);
    expect(screen.getByText(en.tables.fieldDefinitions)).toBeInTheDocument();
  });

  it('renders field description keys', () => {
    render(<TablesInDetail />);
    // fieldZ resolves to "Z" which appears many times; check the description instead
    expect(screen.getByText(en.tables.fieldZDescription)).toBeInTheDocument();
    expect(screen.getByText(en.tables.fieldADescription)).toBeInTheDocument();
  });
});
