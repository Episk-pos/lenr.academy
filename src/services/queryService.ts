import type { Database } from 'sql.js';
import type {
  QueryFilter,
  QueryResult,
  FusionReaction,
  FissionReaction,
  TwoToTwoReaction,
  Nuclide,
  Element,
  AtomicRadiiData,
  DecayData,
} from '../types';

/**
 * Expand element list to include isotope variants
 * For example, when H is selected, also include D (deuterium)
 */
function expandElementList(elements: string[]): string[] {
  const expanded = [...elements];

  // If H is selected, also include D
  if (elements.includes('H') && !elements.includes('D')) {
    expanded.push('D');
  }

  return expanded;
}

/**
 * Build SQL WHERE clause from filter
 */
function buildWhereClause(filter: QueryFilter, tableType: 'fusion' | 'fission' | 'twotwo'): string {
  const conditions: string[] = [];

  // Energy range
  if (filter.minMeV !== undefined) {
    conditions.push(`MeV >= ${filter.minMeV}`);
  }
  if (filter.maxMeV !== undefined) {
    conditions.push(`MeV <= ${filter.maxMeV}`);
  }

  // Neutrino types
  if (filter.neutrinoTypes && filter.neutrinoTypes.length > 0 && filter.neutrinoTypes.length < 3) {
    const types = filter.neutrinoTypes.map(t => `'${t}'`).join(',');
    conditions.push(`neutrino IN (${types})`);
  }

  // Element-specific lists (E1 and E/E2)
  if (filter.element1List && filter.element1List.length > 0) {
    const expandedElements = expandElementList(filter.element1List);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    conditions.push(`E1 IN (${elements})`);
  }

  if (filter.element2List && filter.element2List.length > 0) {
    const expandedElements = expandElementList(filter.element2List);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    if (tableType === 'fusion') {
      conditions.push(`E2 IN (${elements})`);
    } else if (tableType === 'fission') {
      conditions.push(`(E1 IN (${elements}) OR E2 IN (${elements}))`);
    } else {
      conditions.push(`E2 IN (${elements})`);
    }
  }

  // Output element filter (for fusion output element E)
  if (filter.outputElementList && filter.outputElementList.length > 0) {
    const expandedElements = expandElementList(filter.outputElementList);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    if (tableType === 'fusion') {
      conditions.push(`E IN (${elements})`);
    }
  }

  // Fission output element 1 filter
  if (filter.outputElement1List && filter.outputElement1List.length > 0) {
    const expandedElements = expandElementList(filter.outputElement1List);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    if (tableType === 'fission') {
      conditions.push(`E1 IN (${elements})`);
    }
  }

  // Fission output element 2 filter
  if (filter.outputElement2List && filter.outputElement2List.length > 0) {
    const expandedElements = expandElementList(filter.outputElement2List);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    if (tableType === 'fission') {
      conditions.push(`E2 IN (${elements})`);
    }
  }

  // TwoToTwo output element 3 filter
  if (filter.outputElement3List && filter.outputElement3List.length > 0) {
    const expandedElements = expandElementList(filter.outputElement3List);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    if (tableType === 'twotwo') {
      conditions.push(`E3 IN (${elements})`);
    }
  }

  // TwoToTwo output element 4 filter
  if (filter.outputElement4List && filter.outputElement4List.length > 0) {
    const expandedElements = expandElementList(filter.outputElement4List);
    const elements = expandedElements.map(e => `'${e}'`).join(',');
    if (tableType === 'twotwo') {
      conditions.push(`E4 IN (${elements})`);
    }
  }

  // Legacy elements filter (for backwards compatibility)
  if (filter.elements && filter.elements.length > 0) {
    const elements = filter.elements.map(e => `'${e}'`).join(',');
    if (tableType === 'fusion') {
      conditions.push(`(E1 IN (${elements}) OR E IN (${elements}))`);
    } else if (tableType === 'fission') {
      conditions.push(`E IN (${elements})`);
    } else {
      conditions.push(`(E1 IN (${elements}) OR E2 IN (${elements}))`);
    }
  }

  // Boson/Fermion filters
  if (filter.bosonFermionFilter) {
    const { nuclear, atomic } = filter.bosonFermionFilter;

    if (nuclear && nuclear !== 'either') {
      if (tableType === 'fusion') {
        conditions.push(`nBorF1 = '${nuclear}'`);
      } else if (tableType === 'fission') {
        conditions.push(`nBorF = '${nuclear}'`);
      } else {
        conditions.push(`(nBorF1 = '${nuclear}' OR nBorF2 = '${nuclear}')`);
      }
    }

    if (atomic && atomic !== 'either') {
      if (tableType === 'fusion') {
        conditions.push(`aBorF1 = '${atomic}'`);
      } else if (tableType === 'fission') {
        conditions.push(`aBorF = '${atomic}'`);
      } else {
        conditions.push(`(aBorF1 = '${atomic}' OR aBorF2 = '${atomic}')`);
      }
    }
  }

  return conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
}

/**
 * Build ORDER BY clause
 */
function buildOrderClause(filter: QueryFilter): string {
  const orderBy = filter.orderBy || 'MeV';
  const direction = filter.orderDirection || 'desc';
  return `ORDER BY ${orderBy} ${direction.toUpperCase()}`;
}

/**
 * Query Fusion reactions
 */
export function queryFusion(db: Database, filter: QueryFilter): QueryResult<FusionReaction> {
  const startTime = performance.now();

  const whereClause = buildWhereClause(filter, 'fusion');
  const orderClause = buildOrderClause(filter);
  const limit = Math.min(filter.limit || 100, 1000);

  // First, count total matching rows
  const countSql = `SELECT COUNT(*) as total FROM FusionAll ${whereClause}`;
  const countResult = db.exec(countSql);
  const totalCount = (countResult[0]?.values[0]?.[0] as number) || 0;

  // Then, fetch limited results
  const sql = `
    SELECT * FROM FusionAll
    ${whereClause}
    ${orderClause}
    LIMIT ${limit}
  `;

  const results = db.exec(sql);
  const reactions: FusionReaction[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const reaction: any = {};
      columns.forEach((col, idx) => {
        reaction[col] = row[idx];
      });
      reactions.push(reaction as FusionReaction);
    });
  }

  // Get unique nuclides and elements
  const nuclides = getUniqueNuclides(db, reactions, 'fusion');
  const elements = getUniqueElements(db, reactions, 'fusion');

  const executionTime = performance.now() - startTime;

  return {
    reactions,
    nuclides,
    elements,
    executionTime,
    rowCount: reactions.length,
    totalCount,
  };
}

/**
 * Query Fission reactions
 */
export function queryFission(db: Database, filter: QueryFilter): QueryResult<FissionReaction> {
  const startTime = performance.now();

  const whereClause = buildWhereClause(filter, 'fission');
  const orderClause = buildOrderClause(filter);
  const limit = Math.min(filter.limit || 100, 1000);

  // First, count total matching rows
  const countSql = `SELECT COUNT(*) as total FROM FissionAll ${whereClause}`;
  const countResult = db.exec(countSql);
  const totalCount = (countResult[0]?.values[0]?.[0] as number) || 0;

  // Then, fetch limited results
  const sql = `
    SELECT * FROM FissionAll
    ${whereClause}
    ${orderClause}
    LIMIT ${limit}
  `;

  const results = db.exec(sql);
  const reactions: FissionReaction[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const reaction: any = {};
      columns.forEach((col, idx) => {
        reaction[col] = row[idx];
      });
      reactions.push(reaction as FissionReaction);
    });
  }

  const nuclides = getUniqueNuclides(db, reactions, 'fission');
  const elements = getUniqueElements(db, reactions, 'fission');

  const executionTime = performance.now() - startTime;

  return {
    reactions,
    nuclides,
    elements,
    executionTime,
    rowCount: reactions.length,
    totalCount,
  };
}

/**
 * Query TwoToTwo reactions
 */
export function queryTwoToTwo(db: Database, filter: QueryFilter): QueryResult<TwoToTwoReaction> {
  const startTime = performance.now();

  const whereClause = buildWhereClause(filter, 'twotwo');
  const orderClause = buildOrderClause(filter);
  const limit = Math.min(filter.limit || 100, 1000);

  // First, count total matching rows
  const countSql = `SELECT COUNT(*) as total FROM TwoToTwoAll ${whereClause}`;
  const countResult = db.exec(countSql);
  const totalCount = (countResult[0]?.values[0]?.[0] as number) || 0;

  // Then, fetch limited results
  const sql = `
    SELECT * FROM TwoToTwoAll
    ${whereClause}
    ${orderClause}
    LIMIT ${limit}
  `;

  const results = db.exec(sql);
  const reactions: TwoToTwoReaction[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const reaction: any = {};
      columns.forEach((col, idx) => {
        reaction[col] = row[idx];
      });
      reactions.push(reaction as TwoToTwoReaction);
    });
  }

  const nuclides = getUniqueNuclides(db, reactions, 'twotwo');
  const elements = getUniqueElements(db, reactions, 'twotwo');

  const executionTime = performance.now() - startTime;

  return {
    reactions,
    nuclides,
    elements,
    executionTime,
    rowCount: reactions.length,
    totalCount,
  };
}

/**
 * Get unique nuclides appearing in results
 */
function getUniqueNuclides(db: Database, reactions: any[], type: string): Nuclide[] {
  const elementSet = new Set<string>();

  reactions.forEach((r) => {
    if (type === 'fusion') {
      elementSet.add(`${r.E1}-${r.A1}`);
      elementSet.add(`${r.E}-${r.A}`);
    } else if (type === 'fission') {
      elementSet.add(`${r.E}-${r.A}`);
      elementSet.add(`${r.E1}-${r.A1}`);
      elementSet.add(`${r.E2}-${r.A2}`);
    } else {
      elementSet.add(`${r.E1}-${r.A1}`);
      elementSet.add(`${r.E2}-${r.A2}`);
      elementSet.add(`${r.E3}-${r.A3}`);
      elementSet.add(`${r.E4}-${r.A4}`);
    }
  });

  if (elementSet.size === 0) return [];

  const conditions = Array.from(elementSet).map(ea => {
    const [e, a] = ea.split('-');
    return `(E = '${e}' AND A = ${a})`;
  }).join(' OR ');

  const sql = `
    SELECT * FROM NuclidesPlus
    WHERE ${conditions}
    ORDER BY Z, A
  `;

  const results = db.exec(sql);
  const nuclides: Nuclide[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        nuclide[col] = row[idx];
      });
      nuclides.push(nuclide as Nuclide);
    });
  }

  return nuclides;
}

/**
 * Get unique elements appearing in results
 */
function getUniqueElements(db: Database, reactions: any[], type: string): Element[] {
  const elementSet = new Set<string>();

  reactions.forEach((r) => {
    if (type === 'fusion') {
      elementSet.add(r.E1);
      elementSet.add(r.E);
    } else if (type === 'fission') {
      elementSet.add(r.E);
      elementSet.add(r.E1);
      elementSet.add(r.E2);
    } else {
      elementSet.add(r.E1);
      elementSet.add(r.E2);
      elementSet.add(r.E3);
      elementSet.add(r.E4);
    }
  });

  if (elementSet.size === 0) return [];

  const elements = Array.from(elementSet).map(e => `'${e}'`).join(',');

  const sql = `
    SELECT * FROM ElementsPlus
    WHERE E IN (${elements})
    ORDER BY Z
  `;

  const results = db.exec(sql);
  const elementData: Element[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const element: any = {};
      columns.forEach((col, idx) => {
        element[col] = row[idx];
      });
      elementData.push(element as Element);
    });
  }

  return elementData;
}

/**
 * Execute custom SQL query (for AllTables page)
 */
export function executeCustomQuery(db: Database, sql: string): any {
  const startTime = performance.now();

  try {
    const results = db.exec(sql);
    const executionTime = performance.now() - startTime;

    if (results.length === 0) {
      return {
        columns: [],
        rows: [],
        executionTime,
        rowCount: 0,
      };
    }

    return {
      columns: results[0].columns,
      rows: results[0].values,
      executionTime,
      rowCount: results[0].values.length,
    };
  } catch (error) {
    throw new Error(`SQL Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all elements from database
 */
export function getAllElements(db: Database): Element[] {
  const sql = 'SELECT * FROM ElementPropertiesPlus ORDER BY Z';
  const results = db.exec(sql);
  const elements: Element[] = [];

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'P': 'Period',
    'G': 'Group',
    'MolarVol': 'MolarVolume',
    'Val': 'Valence',
    'MxInum': 'MaxIonNum',
    'MxInize': 'MaxIonization',
    'ElectG': 'ElectConduct',
    'ThermG': 'ThermConduct'
  };

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const element: any = {};
      columns.forEach((col, idx) => {
        // Map database column names to TypeScript interface property names
        const propertyName = columnMap[col] || col;
        element[propertyName] = row[idx];
      });
      elements.push(element as Element);
    });
  }

  return elements;
}

/**
 * Get a specific element by its symbol
 */
export function getElementBySymbol(db: Database, symbol: string): Element | null {
  const sql = 'SELECT * FROM ElementPropertiesPlus WHERE E = ?';
  const results = db.exec(sql, [symbol]);

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'P': 'Period',
    'G': 'Group',
    'MolarVol': 'MolarVolume',
    'Val': 'Valence',
    'MxInum': 'MaxIonNum',
    'MxInize': 'MaxIonization',
    'ElectG': 'ElectConduct',
    'ThermG': 'ThermConduct'
  };

  if (results.length > 0 && results[0].values.length > 0) {
    const columns = results[0].columns;
    const row = results[0].values[0];
    const element: any = {};
    columns.forEach((col, idx) => {
      // Map database column names to TypeScript interface property names
      const propertyName = columnMap[col] || col;
      element[propertyName] = row[idx];
    });
    return element as Element;
  }

  return null;
}

/**
 * Get all nuclides from database
 */
export function getAllNuclides(db: Database): Nuclide[] {
  const sql = 'SELECT * FROM NuclidesPlus ORDER BY Z, A';
  const results = db.exec(sql);
  const nuclides: Nuclide[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        nuclide[col] = row[idx];
      });
      nuclides.push(nuclide as Nuclide);
    });
  }

  return nuclides;
}

/**
 * Get a specific nuclide by element symbol and mass number
 */
export function getNuclideBySymbol(db: Database, elementSymbol: string, massNumber: number): Nuclide | null {
  const sql = 'SELECT * FROM NuclidesPlus WHERE E = ? AND A = ?';
  const results = db.exec(sql, [elementSymbol, massNumber]);

  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }

  const columns = results[0].columns;
  const row = results[0].values[0];

  const nuclide: any = {};
  columns.forEach((col, idx) => {
    nuclide[col] = row[idx];
  });

  return nuclide as Nuclide;
}

/**
 * Get all nuclides for a specific element by atomic number
 */
export function getNuclidesByElement(db: Database, atomicNumber: number): Nuclide[] {
  const sql = 'SELECT * FROM NuclidesPlus WHERE Z = ? ORDER BY A';
  const results = db.exec(sql, [atomicNumber]);
  const nuclides: Nuclide[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        nuclide[col] = row[idx];
      });
      nuclides.push(nuclide as Nuclide);
    });
  }

  return nuclides;
}

/**
 * Get atomic radii data for a specific element by atomic number
 */
export function getAtomicRadii(db: Database, Z: number): AtomicRadiiData | null {
  const sql = `
    SELECT AtRadEmpirical, AtRadCalculated, AtRadVanDerWaals, AtRadCovalent
    FROM AtomicRadii
    WHERE Z = ?
  `;
  const results = db.exec(sql, [Z]);

  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }

  const [empirical, calculated, vanDerWaals, covalent] = results[0].values[0];

  return {
    empirical: empirical as number | null,
    calculated: calculated as number | null,
    vanDerWaals: vanDerWaals as number | null,
    covalent: covalent as number | null,
  };
}

/**
 * Get radioactive decay data for a specific isotope
 */
export function getRadioactiveDecayData(db: Database, Z: number, A: number): DecayData[] {
  const sql = `
    SELECT RDM, RT, DEKeV, RI, HL, Units
    FROM RadioNuclides
    WHERE Z = ? AND A = ?
    ORDER BY RI DESC
  `;
  const results = db.exec(sql, [Z, A]);

  if (results.length === 0 || results[0].values.length === 0) {
    return [];
  }

  const decayData: DecayData[] = [];
  results[0].values.forEach((row: any[]) => {
    decayData.push({
      decayMode: row[0] as string,
      radiationType: row[1] as string,
      energyKeV: row[2] as number | null,
      intensity: row[3] as number | null,
      halfLife: row[4] as number | null,
      halfLifeUnits: row[5] as string | null,
    });
  });

  return decayData;
}

/**
 * Check if an isotope is radioactive (has decay data)
 */
export function isRadioactive(db: Database, Z: number, A: number): boolean {
  const sql = `
    SELECT COUNT(*) as count
    FROM RadioNuclides
    WHERE Z = ? AND A = ?
  `;
  const results = db.exec(sql, [Z, A]);

  if (results.length === 0 || results[0].values.length === 0) {
    return false;
  }

  return (results[0].values[0][0] as number) > 0;
}

/**
 * Get the primary decay mode for an isotope (highest intensity)
 */
export function getPrimaryDecayMode(db: Database, Z: number, A: number): DecayData | null {
  const sql = `
    SELECT RDM, RT, DEKeV, RI, HL, Units
    FROM RadioNuclides
    WHERE Z = ? AND A = ?
    ORDER BY RI DESC
    LIMIT 1
  `;
  const results = db.exec(sql, [Z, A]);

  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }

  const row = results[0].values[0];
  return {
    decayMode: row[0] as string,
    radiationType: row[1] as string,
    energyKeV: row[2] as number | null,
    intensity: row[3] as number | null,
    halfLife: row[4] as number | null,
    halfLifeUnits: row[5] as string | null,
  };
}

/**
 * Get element symbol by atomic number
 */
export function getElementSymbolByZ(db: Database, Z: number): string | null {
  const sql = `
    SELECT E
    FROM ElementPropertiesPlus
    WHERE Z = ?
    LIMIT 1
  `;
  const results = db.exec(sql, [Z]);
  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }
  return results[0].values[0][0] as string;
}
