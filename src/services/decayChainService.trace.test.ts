// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Database } from 'sql.js';
import type { DecayChainNode } from '../types';
import { createDecayChainFixtureDb } from '../test-utils/decayChainFixture';
import { traceDecayChain, getLinearDecayChain } from './decayChainService';

// Real parkhomov.db rows: Ra-224 ... Tl-208 have RadioNuclides data but no NuclidesPlus row
let db: Database;

beforeAll(async () => {
  db = await createDecayChainFixtureDb();
});

afterAll(() => {
  db?.close();
});

const label = (n: DecayChainNode) => `${n.nuclide.E}-${n.nuclide.A}`;

describe('traceDecayChain for nuclides without a NuclidesPlus row', () => {
  it('traces Ra-224 through the Bi-212 branch (Po-212 | Tl-208) to stable Pb-208', () => {
    const chain = traceDecayChain(db, 88, 224, { maxDepth: 10, minBranchingRatio: 10 });

    const linear: string[] = [];
    let node = chain.root;
    while (node.children.length === 1) {
      linear.push(label(node));
      node = node.children[0];
    }
    linear.push(label(node));
    expect(linear).toEqual(['Ra-224', 'Rn-220', 'Po-216', 'Pb-212', 'Bi-212']);

    // Bi-212: B- to Po-212 (~69%) and alpha to Tl-208 (~31%)
    const branches = node.children.map(c => [label(c), c.decayMode, Math.round(c.branchingRatio!)]);
    expect(branches).toEqual([
      ['Po-212', 'B-', 69],
      ['Tl-208', 'A', 31],
    ]);
    node.children.forEach(c => {
      expect(c.children.map(label)).toEqual(['Pb-208']);
    });

    expect(chain.totalGenerations).toBe(6);
    expect(chain.terminalNuclides).toEqual([
      { Z: 82, A: 208, E: 'Pb', isStable: true },
      { Z: 82, A: 208, E: 'Pb', isStable: true },
    ]);
  });

  it('marks the radioactive members radioactive and only Pb-208 stable', () => {
    const chain = traceDecayChain(db, 88, 224, { maxDepth: 10, minBranchingRatio: 10 });
    const flags = new Map<string, boolean>();
    const walk = (n: DecayChainNode) => {
      flags.set(label(n), n.isStable);
      expect(n.stabilityUnknown).toBeUndefined();
      n.children.forEach(walk);
    };
    walk(chain.root);

    expect(Object.fromEntries(flags)).toEqual({
      'Ra-224': false, 'Rn-220': false, 'Po-216': false, 'Pb-212': false,
      'Bi-212': false, 'Po-212': false, 'Tl-208': false, 'Pb-208': true,
    });
  });

  it("gives every node its own RadioNuclides half-life, not its parent's", () => {
    const chain = traceDecayChain(db, 88, 224, { maxDepth: 10, minBranchingRatio: 10 });
    const halfLives = new Map<string, string | undefined>();
    const walk = (n: DecayChainNode) => {
      halfLives.set(label(n), n.halfLife === undefined ? undefined : `${n.halfLife} ${n.halfLifeUnits}`);
      n.children.forEach(walk);
    };
    walk(chain.root);

    expect(Object.fromEntries(halfLives)).toEqual({
      'Ra-224': '3.66 D',
      'Rn-220': '55.6 S',
      'Po-216': '0.145 S',
      'Pb-212': '10.64 H',
      'Bi-212': '60.55 M',
      'Po-212': '0.299 US',
      'Tl-208': '3.053 M',
      'Pb-208': undefined,
    });
    expect(chain.root.logHalfLife).toBeCloseTo(-1.9991, 4);
  });

  it('starts from Pb-212 (out-of-table) as well', () => {
    const chain = traceDecayChain(db, 82, 212, { maxDepth: 10, minBranchingRatio: 10 });
    expect(label(chain.root)).toBe('Pb-212');
    expect(chain.root.isStable).toBe(false);
    expect(chain.totalGenerations).toBe(3);
    expect(chain.terminalNuclides.every(n => n.E === 'Pb' && n.A === 208 && n.isStable)).toBe(true);
  });

  it('does not mark a daughter stable when it is in neither table (Cl-36 EC -> S-36)', () => {
    const chain = traceDecayChain(db, 17, 36, { maxDepth: 5, minBranchingRatio: 1 });
    const children = Object.fromEntries(chain.root.children.map(c => [label(c), c]));

    expect(children['Ar-36'].isStable).toBe(true);
    expect(children['Ar-36'].stabilityUnknown).toBeUndefined();
    expect(children['S-36'].isStable).toBe(false);
    expect(children['S-36'].stabilityUnknown).toBe(true);

    expect(chain.terminalNuclides).toEqual(expect.arrayContaining([
      { Z: 18, A: 36, E: 'Ar', isStable: true },
      { Z: 16, A: 36, E: 'S', isStable: false, stabilityUnknown: true },
    ]));
  });

  it('follows the primary mode to Pb-208 in the linear chain', () => {
    const chain = getLinearDecayChain(db, 88, 224);
    expect(chain.map(n => `${n.E}-${n.A}`)).toEqual([
      'Ra-224', 'Rn-220', 'Po-216', 'Pb-212', 'Bi-212', 'Po-212', 'Pb-208',
    ]);
  });
});
