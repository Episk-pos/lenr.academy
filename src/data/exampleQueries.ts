import { QueryFilter } from '../types';

export interface ExampleQuery {
  name: string;
  description: string;
  queryType: 'fusion' | 'fission' | 'twotwo' | 'element-data' | 'cascades' | 'muller-resonance';
  filter: QueryFilter;
  element1List?: string[];
  element2List?: string[];
  outputElementList?: string[];
  /** For element-data links: Z and optional A */
  elementZ?: number;
  elementA?: number;
  /** For cascades links: material preset ID or fuel list */
  materialId?: string;
  /** For muller-resonance links: URL params */
  mullerParams?: Record<string, string>;
}

export const EXAMPLE_QUERIES: ExampleQuery[] = [
  // Fusion examples (2)
  {
    name: 'Hydrogen-Lithium Fusion',
    description: 'Classic LENR reaction pathway. H + Li fusion produces beryllium and helium isotopes with significant energy release.',
    queryType: 'fusion',
    element1List: ['H'],
    element2List: ['Li'],
    filter: {},
  },
  {
    name: 'Nickel-Hydrogen Fusion',
    description: 'Investigated in Rossi E-Cat and Parkhomov replication experiments. Ni + H reactions produce copper isotopes.',
    queryType: 'fusion',
    element1List: ['H'],
    element2List: ['Ni'],
    filter: {},
  },

  // Fission examples (2)
  {
    name: 'Uranium Fission Pathways',
    description: 'All fission pathways from uranium isotopes. Shows the diverse product spectrum of uranium splitting.',
    queryType: 'fission',
    filter: { elements: ['U'] },
  },
  {
    name: 'Palladium Fission',
    description: 'Pd fission pathways relevant to Fleischmann-Pons cold fusion experiments using palladium electrodes.',
    queryType: 'fission',
    filter: { elements: ['Pd'] },
  },

  // Two-to-Two examples (2)
  {
    name: 'Proton-Boron Reactions',
    description: 'H + B-11 produces three alpha particles in the aneutronic fusion reaction (p + B-11 → 3α), considered ideal for clean energy.',
    queryType: 'twotwo',
    element1List: ['H'],
    element2List: ['B'],
    filter: {},
  },
  {
    name: 'Deuterium-Nickel Reactions',
    description: 'D + Ni two-to-two reactions showing deuterium-based transmutations with nickel, lithium, aluminum, boron, and nitrogen.',
    queryType: 'twotwo',
    element1List: ['D'],
    element2List: ['Ni', 'Li', 'Al', 'B', 'N'],
    filter: {},
  },

  // Element Data examples (2)
  {
    name: 'Uranium-238 Decay Chain',
    description: 'The most famous natural decay series (4n+2). Trace 14 steps from U-238 through radium and radon down to stable Pb-206.',
    queryType: 'element-data',
    elementZ: 92,
    elementA: 238,
    filter: {},
  },
  {
    name: 'Iron-56 — Peak Binding Energy',
    description: 'Fe-56 has the highest binding energy per nucleon of any nuclide, making it the endpoint of stellar nucleosynthesis.',
    queryType: 'element-data',
    elementZ: 26,
    elementA: 56,
    filter: {},
  },

  // Muller Resonance example (1)
  {
    name: 'Palladium NAE Analysis',
    description: 'Explore palladium\'s nuclear active environment predictions — central to Fleischmann-Pons deuterium loading experiments.',
    queryType: 'muller-resonance',
    mullerParams: { tab: 'nae', element: 'Pd', naeFilter: 'true' },
    filter: {},
  },

  // Cascades example (1)
  {
    name: 'Parkhomov Ni-LiAlH₄ Cascade',
    description: 'Simulate the 2014 Parkhomov replication of the Rossi reactor using natural nickel with lithium aluminum hydride fuel.',
    queryType: 'cascades',
    materialId: 'parkhomov-2014',
    filter: {},
  },
];
