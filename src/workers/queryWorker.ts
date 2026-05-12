/**
 * Query Execution Web Worker
 *
 * Runs SQL query execution in a background thread to keep the UI responsive.
 * Supports fusion, fission, and two-to-two reaction queries.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { QueryFilter, Nuclide, Element } from '../types';

// Message types
export interface QueryWorkerRequest {
  type: 'query';
  queryType: 'fusion' | 'fission' | 'twotwo';
  filter: QueryFilter;
  dbBuffer: ArrayBuffer;
}

export interface QueryWorkerResult {
  reactions: any[];
  nuclides: Nuclide[];
  elements: Element[];
  radioactiveNuclides: string[];  // Serialized as array (Set not transferable)
  executionTime: number;
  rowCount: number;
  totalCount: number;
}

export interface QueryWorkerCompleteMessage {
  type: 'complete';
  result: QueryWorkerResult;
}

export interface QueryWorkerErrorMessage {
  type: 'error';
  error: string;
}

export type QueryWorkerResponse = QueryWorkerCompleteMessage | QueryWorkerErrorMessage;

let db: SqlJsDatabase | null = null;

/**
 * Initialize the database from an ArrayBuffer.
 * Caches the db instance so subsequent queries skip re-initialization.
 */
async function initDatabase(buffer: ArrayBuffer): Promise<void> {
  // Skip if already initialized (buffer is transferred so we cannot compare,
  // but re-init is unnecessary when the worker already holds a valid db)
  if (db) return;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });
  db = new SQL.Database(new Uint8Array(buffer));
}

/**
 * Build SQL WHERE clause from filter (mirrors queryService.ts logic)
 */
function buildWhereClause(filter: QueryFilter, tableType: 'fusion' | 'fission' | 'twotwo'): string {
  const conditions: string[] = [];

  if (filter.minMeV !== undefined) {
    conditions.push(`MeV >= ${filter.minMeV}`);
  }
  if (filter.maxMeV !== undefined) {
    conditions.push(`MeV <= ${filter.maxMeV}`);
  }

  if (filter.neutrinoType && filter.neutrinoType !== 'any') {
    if (filter.neutrinoType === 'none') {
      conditions.push(`neutrino = 'none'`);
    } else if (filter.neutrinoType === 'left') {
      conditions.push(`neutrino = 'left'`);
    } else if (filter.neutrinoType === 'right') {
      conditions.push(`neutrino = 'right'`);
    } else if (filter.neutrinoType === 'left-right') {
      conditions.push(`neutrino IN ('left', 'right')`);
    }
  }

  if (filter.element1List && filter.element1List.length > 0) {
    const elements = filter.element1List.map(e => `'${e}'`).join(',');
    conditions.push(`E1 IN (${elements})`);
  }

  if (filter.element2List && filter.element2List.length > 0) {
    const elements = filter.element2List.map(e => `'${e}'`).join(',');
    if (tableType === 'fusion') {
      conditions.push(`E2 IN (${elements})`);
    } else if (tableType === 'fission') {
      conditions.push(`(E1 IN (${elements}) OR E2 IN (${elements}))`);
    } else {
      conditions.push(`E2 IN (${elements})`);
    }
  }

  if (filter.outputElementList && filter.outputElementList.length > 0) {
    const elements = filter.outputElementList.map(e => `'${e}'`).join(',');
    if (tableType === 'fusion') {
      conditions.push(`E IN (${elements})`);
    }
  }

  if (filter.outputElement1List && filter.outputElement1List.length > 0) {
    const elements = filter.outputElement1List.map(e => `'${e}'`).join(',');
    if (tableType === 'fission') {
      conditions.push(`(E1 IN (${elements}) OR E2 IN (${elements}))`);
    }
  }

  if (filter.outputElement2List && filter.outputElement2List.length > 0) {
    const elements = filter.outputElement2List.map(e => `'${e}'`).join(',');
    if (tableType === 'fission') {
      conditions.push(`(E1 IN (${elements}) OR E2 IN (${elements}))`);
    }
  }

  if (filter.outputElement3List && filter.outputElement3List.length > 0) {
    const elements = filter.outputElement3List.map(e => `'${e}'`).join(',');
    if (tableType === 'twotwo') {
      conditions.push(`E3 IN (${elements})`);
    }
  }

  if (filter.outputElement4List && filter.outputElement4List.length > 0) {
    const elements = filter.outputElement4List.map(e => `'${e}'`).join(',');
    if (tableType === 'twotwo') {
      conditions.push(`E4 IN (${elements})`);
    }
  }

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

function buildOrderClause(filter: QueryFilter): string {
  const validColumns = ['MeV', 'E', 'E1', 'E2', 'E3', 'E4', 'Z', 'A', 'Z1', 'A1', 'Z2', 'A2', 'Z3', 'A3', 'Z4', 'A4', 'neutrino'];
  const orderBy = validColumns.includes(filter.orderBy || 'MeV') ? (filter.orderBy || 'MeV') : 'MeV';
  const direction = (filter.orderDirection === 'asc' || filter.orderDirection === 'desc') ? filter.orderDirection.toUpperCase() : 'DESC';
  return `ORDER BY ${orderBy} ${direction}`;
}

/**
 * Get unique nuclides from reaction results
 */
function getUniqueNuclides(reactions: any[], type: string): Nuclide[] {
  if (!db) return [];

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

  const sql = `SELECT * FROM NuclidesPlus WHERE ${conditions} ORDER BY Z, A`;
  const columnMap: { [key: string]: string } = { 'LHL': 'logHalfLife' };
  const results = db.exec(sql);
  const nuclides: Nuclide[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    results[0].values.forEach((row: any[]) => {
      const nuclide: any = {};
      columns.forEach((col, idx) => {
        nuclide[columnMap[col] || col] = row[idx];
      });
      nuclides.push(nuclide as Nuclide);
    });
  }

  return nuclides;
}

/**
 * Get unique elements from reaction results
 */
function getUniqueElements(reactions: any[], type: string): Element[] {
  if (!db) return [];

  const elementSet = new Set<string>();
  reactions.forEach((r) => {
    if (type === 'fusion') {
      elementSet.add(r.E1); elementSet.add(r.E2); elementSet.add(r.E);
    } else if (type === 'fission') {
      elementSet.add(r.E); elementSet.add(r.E1); elementSet.add(r.E2);
    } else {
      elementSet.add(r.E1); elementSet.add(r.E2); elementSet.add(r.E3); elementSet.add(r.E4);
    }
  });

  if (elementSet.size === 0) return [];

  const elements = Array.from(elementSet).map(e => `'${e}'`).join(',');
  const sql = `SELECT * FROM ElementsPlus WHERE E IN (${elements}) ORDER BY Z`;
  const results = db.exec(sql);
  const elementData: Element[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    results[0].values.forEach((row: any[]) => {
      const element: any = {};
      columns.forEach((col, idx) => { element[col] = row[idx]; });
      elementData.push(element as Element);
    });
  }

  return elementData;
}

/**
 * Get radioactive nuclides from a list of nuclides (batch query)
 */
function getRadioactiveNuclides(nuclides: Nuclide[]): string[] {
  if (!db || nuclides.length === 0) return [];

  const conditions = nuclides.map(n => `(Z = ${n.Z} AND A = ${n.A})`).join(' OR ');
  const sql = `SELECT DISTINCT Z, A FROM RadioNuclides WHERE ${conditions}`;
  const results = db.exec(sql);
  const radioactive: string[] = [];

  if (results.length > 0) {
    results[0].values.forEach((row: any[]) => {
      radioactive.push(`${row[0]}-${row[1]}`);
    });
  }

  return radioactive;
}

/**
 * Execute a reaction query
 */
function executeQuery(queryType: 'fusion' | 'fission' | 'twotwo', filter: QueryFilter): QueryWorkerResult {
  if (!db) throw new Error('Database not initialized');

  const startTime = performance.now();
  const tableMap = { fusion: 'FusionAll', fission: 'FissionAll', twotwo: 'TwoToTwoAll' };
  const table = tableMap[queryType];

  const whereClause = buildWhereClause(filter, queryType);
  const orderClause = buildOrderClause(filter);
  const hasLimit = filter.limit !== undefined && filter.limit > 0;
  const limit = hasLimit ? Math.min(filter.limit!, 1000) : undefined;

  // Count total
  const countSql = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;
  const countResult = db.exec(countSql);
  const totalCount = (countResult[0]?.values[0]?.[0] as number) || 0;

  // Fetch results
  const sql = `SELECT * FROM ${table} ${whereClause} ${orderClause} ${limit !== undefined ? `LIMIT ${limit}` : ''}`;
  const results = db.exec(sql);
  const reactions: any[] = [];

  if (results.length > 0) {
    const columns = results[0].columns;
    results[0].values.forEach((row: any[]) => {
      const reaction: any = {};
      columns.forEach((col, idx) => { reaction[col] = row[idx]; });
      reactions.push(reaction);
    });
  }

  const nuclides = getUniqueNuclides(reactions, queryType);
  const elements = getUniqueElements(reactions, queryType);
  const radioactiveNuclides = getRadioactiveNuclides(nuclides);

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

// Worker message handler
self.onmessage = async (event: MessageEvent<QueryWorkerRequest>) => {
  const message = event.data;

  if (message.type === 'query') {
    try {
      await initDatabase(message.dbBuffer);
      const result = executeQuery(message.queryType, message.filter);
      const response: QueryWorkerCompleteMessage = { type: 'complete', result };
      self.postMessage(response);
    } catch (error) {
      const response: QueryWorkerErrorMessage = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      self.postMessage(response);
    }
  }
};
