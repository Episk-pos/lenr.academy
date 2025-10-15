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
 * For example, when H is selected, also include D (deuterium) and T (tritium)
 */
function expandElementList(elements: string[]): string[] {
  const expanded = [...elements];
  const hasHydrogen = expanded.includes('H');
  const hasDeuterium = expanded.includes('D');
  const hasTritium = expanded.includes('T');

  // Selecting elemental hydrogen exposes its common isotopes
  if (hasHydrogen) {
    if (!hasDeuterium) {
      expanded.push('D');
    }
    if (!hasTritium) {
      expanded.push('T');
    }
  }

  // Selecting an isotope should still match hydrogen entries in the database
  if (!hasHydrogen && (hasDeuterium || hasTritium)) {
    expanded.push('H');
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
 * Get Set of radioactive nuclides from a list of nuclides
 * Returns Set of "Z-A" format (e.g., "26-56") for O(1) lookup
 * Single batch SQL query instead of individual queries per nuclide
 */
export function getRadioactiveNuclides(db: Database, nuclides: Nuclide[]): Set<string> {
  if (nuclides.length === 0) return new Set();

  // Build WHERE clause for all nuclides
  const conditions = nuclides.map(n => `(Z = ${n.Z} AND A = ${n.A})`).join(' OR ');

  const sql = `
    SELECT DISTINCT Z, A
    FROM RadioNuclides
    WHERE ${conditions}
  `;

  const results = db.exec(sql);
  const radioactive = new Set<string>();

  if (results.length > 0) {
    results[0].values.forEach((row: any[]) => {
      radioactive.add(`${row[0]}-${row[1]}`);
    });
  }

  return radioactive;
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

  // Get radioactive nuclides in a single batch query
  const radioactiveNuclides = getRadioactiveNuclides(db, nuclides);

  const executionTime = performance.now() - startTime;

  return {
    reactions,
    nuclides,
    elements,
    radioactiveNuclides,
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

  // Get radioactive nuclides in a single batch query
  const radioactiveNuclides = getRadioactiveNuclides(db, nuclides);

  const executionTime = performance.now() - startTime;

  return {
    reactions,
    nuclides,
    elements,
    radioactiveNuclides,
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

  // Get radioactive nuclides in a single batch query
  const radioactiveNuclides = getRadioactiveNuclides(db, nuclides);

  const executionTime = performance.now() - startTime;

  return {
    reactions,
    nuclides,
    elements,
    radioactiveNuclides,
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
      elementSet.add(`${r.E2}-${r.A2}`);
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

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'LHL': 'logHalfLife',
  };

  const results = db.exec(sql);
  const nuclides: Nuclide[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        // Map database column names to TypeScript interface property names
        const propertyName = columnMap[col] || col;
        nuclide[propertyName] = row[idx];
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

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'LHL': 'logHalfLife',
  };

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        // Map database column names to TypeScript interface property names
        const propertyName = columnMap[col] || col;
        nuclide[propertyName] = row[idx];
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

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'LHL': 'logHalfLife',
  };

  const columns = results[0].columns;
  const row = results[0].values[0];

  const nuclide: any = {};
  columns.forEach((col, idx) => {
    // Map database column names to TypeScript interface property names
    const propertyName = columnMap[col] || col;
    nuclide[propertyName] = row[idx];
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

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'LHL': 'logHalfLife',
  };

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        // Map database column names to TypeScript interface property names
        const propertyName = columnMap[col] || col;
        nuclide[propertyName] = row[idx];
      });
      nuclides.push(nuclide as Nuclide);
    });
  }

  return nuclides;
}

/**
 * Get all nuclides for a specific element including RadioNuclides-only isotopes
 * Returns both full nuclides from NuclidesPlus and minimal data for RadioNuclides-only isotopes
 */
export function getAllNuclidesByElement(db: Database, Z: number): import('../types').DisplayNuclide[] {
  // First get all NuclidesPlus entries
  const nuclidesPlus = getNuclidesByElement(db, Z);
  const nuclidesMap = new Map<number, Nuclide>();
  nuclidesPlus.forEach(n => nuclidesMap.set(n.A, n));

  // Get RadioNuclides-only entries (those not in NuclidesPlus)
  // Use CTE to properly get one row per mass number A, taking the decay mode with highest intensity
  const radioOnlySql = `
    WITH MaxRI AS (
      SELECT Z, A, MAX(RI) as max_ri
      FROM RadioNuclides
      WHERE Z = ? AND A NOT IN (SELECT A FROM NuclidesPlus WHERE Z = ?)
      GROUP BY Z, A
    )
    SELECT DISTINCT rn.E, rn.Z, rn.A, rn.RDM, rn.LHL, rn.HL, rn.Units
    FROM RadioNuclides rn
    INNER JOIN MaxRI m ON rn.Z = m.Z AND rn.A = m.A AND rn.RI = m.max_ri
    ORDER BY rn.A
  `;

  const radioResults = db.exec(radioOnlySql, [Z, Z]);
  const displayNuclides: import('../types').DisplayNuclide[] = [];

  // Add all NuclidesPlus entries as 'full' type
  nuclidesPlus.forEach(nuclide => {
    displayNuclides.push({ type: 'full', data: nuclide });
  });

  // Add RadioNuclides-only entries as 'radioactive-only' type (one per mass number)
  // Map database columns (LHL, HL) to TypeScript properties (logHalfLife, halfLife)
  if (radioResults.length > 0 && radioResults[0].values.length > 0) {
    radioResults[0].values.forEach((row: any[]) => {
      const [E, Z, A, RDM, LHL, HL, Units] = row;
      displayNuclides.push({
        type: 'radioactive-only',
        data: {
          E: E as string,
          Z: Z as number,
          A: A as number,
          RDM: RDM as string,
          logHalfLife: LHL as number | null,
          halfLife: HL as number | null,
          Units: Units as string | null,
        }
      });
    });
  }

  // Sort by mass number (A)
  displayNuclides.sort((a, b) => {
    const aVal = a.type === 'full' ? a.data.A : a.data.A;
    const bVal = b.type === 'full' ? b.data.A : b.data.A;
    return aVal - bVal;
  });

  return displayNuclides;
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
 * Check if an element has only radioactive isotopes (no stable isotopes)
 * An isotope is considered stable if LHL > 9 (half-life > 1 billion years)
 */
export function hasOnlyRadioactiveIsotopes(db: Database, Z: number): boolean {
  const sql = `
    SELECT MAX(CAST(COALESCE(LHL, 0) AS REAL)) as max_lhl
    FROM NuclidesPlus
    WHERE Z = ?
  `;
  const results = db.exec(sql, [Z]);

  if (results.length === 0 || results[0].values.length === 0) {
    return false;
  }

  const maxLHL = results[0].values[0][0] as number;
  return maxLHL <= 9;
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

/**
 * Get radioactive nuclide data for isotopes not in NuclidesPlus
 * Returns aggregated data from RadioNuclides table including all decay modes
 */
export function getRadioactiveNuclideData(db: Database, E: string, A: number): import('../types').RadioactiveNuclideData | null {
  // First, check if this isotope exists in RadioNuclides
  // Map database columns (HL, LHL) to TypeScript properties (halfLife, logHalfLife)
  const checkSql = `
    SELECT Z, RDM, HL, Units, LHL
    FROM RadioNuclides
    WHERE E = ? AND A = ?
    ORDER BY RI DESC
    LIMIT 1
  `;
  const checkResults = db.exec(checkSql, [E, A]);

  if (checkResults.length === 0 || checkResults[0].values.length === 0) {
    return null;
  }

  const [Z, RDM, HL, Units, LHL] = checkResults[0].values[0];

  // Get all decay data for this isotope
  const decayData = getRadioactiveDecayData(db, Z as number, A);

  return {
    E,
    Z: Z as number,
    A,
    RDM: RDM as string,
    halfLife: HL as number | null,
    Units: Units as string | null,
    logHalfLife: LHL as number | null,
    decayData,
  };
}

/**
 * Radioactive decay record interface (maps to RadioNuclides table)
 */
export interface RadioactiveDecay {
  id: number;
  E: string;        // Element symbol
  Z: number;        // Atomic number
  A: number;        // Mass number
  RDM: string;      // Radioactive decay mode
  halfLife: number | null;      // Half-life numeric value
  Units: string | null;         // Half-life units
  logHalfLife: number | null;   // Log₁₀ of half-life in years
  RT: string;       // Radiation type
  DEKeV: number | null;   // Decay energy in keV
  RI: number | null;      // Relative intensity (%)
}

/**
 * Get unique element symbols from the RadioNuclides table
 * Used for populating filter dropdowns
 */
export function getUniqueDecayElements(db: Database): string[] {
  const sql = 'SELECT DISTINCT E FROM RadioNuclides ORDER BY E';
  const results = db.exec(sql);

  if (results.length === 0) return [];

  return results[0].values.map(row => row[0] as string);
}

/**
 * Get unique decay modes from the RadioNuclides table
 * Used for populating filter dropdowns
 */
export function getUniqueDecayModes(db: Database): string[] {
  const sql = 'SELECT DISTINCT RDM FROM RadioNuclides WHERE RDM IS NOT NULL ORDER BY RDM';
  const results = db.exec(sql);

  if (results.length === 0) return [];

  return results[0].values.map(row => row[0] as string);
}

/**
 * Get unique radiation types from the RadioNuclides table
 * Used for populating filter dropdowns
 */
export function getUniqueRadiationTypes(db: Database): string[] {
  const sql = 'SELECT DISTINCT RT FROM RadioNuclides WHERE RT IS NOT NULL ORDER BY RT';
  const results = db.exec(sql);

  if (results.length === 0) return [];

  return results[0].values.map(row => row[0] as string);
}

/**
 * Get all radioactive decay records with pagination support
 * Used for the Decays tab in Show Element Data page
 */
export function getAllDecays(
  db: Database,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }
): { decays: RadioactiveDecay[]; totalCount: number } {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const sortBy = options?.sortBy || 'Z';
  const sortDirection = (options?.sortDirection || 'asc').toUpperCase();

  // Get total count
  const countSql = 'SELECT COUNT(*) as total FROM RadioNuclides';
  const countResult = db.exec(countSql);
  const totalCount = (countResult[0]?.values[0]?.[0] as number) || 0;

  // Get paginated data
  const sql = `
    SELECT id, E, Z, A, RDM, HL, Units, LHL, RT, DEKeV, RI
    FROM RadioNuclides
    ORDER BY ${sortBy} ${sortDirection}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const results = db.exec(sql);
  const decays: RadioactiveDecay[] = [];

  // Column name mapping from database to TypeScript interface
  const columnMap: { [key: string]: string } = {
    'HL': 'halfLife',
    'LHL': 'logHalfLife',
  };

  if (results.length > 0) {
    const columns = results[0].columns;
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const decay: any = {};
      columns.forEach((col, idx) => {
        // Map database column names to TypeScript interface property names
        const propertyName = columnMap[col] || col;
        decay[propertyName] = row[idx];
      });
      decays.push(decay as RadioactiveDecay);
    });
  }

  return { decays, totalCount };
}
