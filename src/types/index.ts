// Core data types for Nanosoft nuclear transmutation tables

export type NeutrinoType = 'none' | 'left' | 'right' | 'left-right' | 'any';
export type BosonFermionType = 'b' | 'f';
export type ReactionType = 'fusion' | 'fission' | 'twotwo';
export type HeatmapMode = 'frequency' | 'energy' | 'diversity';
export type NodeRole = 'fuel' | 'intermediate' | 'product' | 'stable';

export interface Nuclide {
  id: number;
  Z: number;        // Atomic number (protons)
  A: number;        // Mass number
  E: string;        // Element symbol
  BE: number;       // Binding Energy in MeV
  AMU: number;      // Atomic mass unit
  nBorF: BosonFermionType;  // Nuclear Boson or Fermion
  aBorF: BosonFermionType;  // Atomic Boson or Fermion
  logHalfLife?: number;     // log₁₀ of half-life in years
  BEN?: number;     // Binding Energy per Nucleon (BE/A)
  SUS?: string;     // Status: SPN (Stable Primordial), SYN (Synthetic), UPN (Unstable Primordial)
  RDM?: string;     // Primary decay mode (B-, EC, A, etc.)
  DEMeV?: number;   // Decay energy in MeV
  pcaNCrust?: number;  // % abundance in Earth's crust
  ppmNCrust?: number;  // ppm abundance in Earth's crust
  ppmNSolar?: number;  // ppm abundance in solar system
  SP?: string;      // Nuclear spin (e.g., "1/2+", "3/2-")
  MD?: number | string;      // Magnetic dipole moment
  EQ?: string;      // Electric quadrupole moment
  RCPT?: string;    // Resonance capture cross section
  Inova_MHz?: number;  // NMR frequency in MHz
  MagGR?: number;   // Magnetic gyromagnetic ratio
}

export interface Element {
  Z: number;
  E: string;
  EName: string;
  Period: number;
  Group: number;
  AWeight?: number;
  ARadius?: number;
  MolarVolume?: number;
  Melting?: number;      // in Kelvin
  Boiling?: number;      // in Kelvin
  Negativity?: number;
  Affinity?: number;
  Valence?: number;
  MaxIonNum?: number;
  MaxIonization?: number;
  STPDensity?: number;
  ElectConduct?: number;
  ThermConduct?: number;
  SpecHeat?: number;
  MagType?: string;      // Magnetic type (e.g., 'Ferromagnetic')
}

export interface AtomicRadiiData {
  empirical: number | null;     // Experimentally measured radius (pm)
  calculated: number | null;    // Theoretically calculated radius (pm)
  vanDerWaals: number | null;   // Van der Waals radius (pm)
  covalent: number | null;      // Covalent bond radius (pm)
}

export interface DecayData {
  decayMode: string;            // Radioactive decay mode (e.g., 'A', 'B-', 'EC')
  radiationType: string;        // Radiation type emitted
  energyKeV: number | null;     // Decay energy in keV
  intensity: number | null;     // Relative intensity (%)
  halfLife: number | null;      // Half-life numeric value
  halfLifeUnits: string | null; // Half-life units (s, m, h, d, y)
}

export interface RadioactiveNuclideData {
  E: string;                    // Element symbol
  Z: number;                    // Atomic number
  A: number;                    // Mass number
  RDM: string;                  // Primary decay mode
  halfLife: number | null;      // Half-life value
  Units: string | null;         // Half-life units
  logHalfLife: number | null;   // Log₁₀ half-life in years
  decayData: DecayData[];       // Full decay table
}

// Simplified data for RadioNuclides-only isotopes (for display in lists)
export interface RadioNuclideListItem {
  E: string;                    // Element symbol
  Z: number;                    // Atomic number
  A: number;                    // Mass number
  RDM: string;                  // Primary decay mode
  logHalfLife: number | null;   // Log₁₀ half-life in years
  halfLife: number | null;      // Half-life value
  Units: string | null;         // Half-life units
}

// Union type for displaying nuclides in lists
export type DisplayNuclide =
  | { type: 'full'; data: Nuclide }
  | { type: 'radioactive-only'; data: RadioNuclideListItem }

export interface FusionReaction {
  id: number;
  E1: string;       // Input element 1 symbol
  Z1: number;       // Input element 1 atomic number
  A1: number;       // Input element 1 mass number
  E2: string;       // Input element 2 symbol
  Z2: number;       // Input element 2 atomic number
  A2: number;       // Input element 2 mass number
  E: string;        // Output element symbol
  Z: number;        // Output atomic number
  A: number;        // Output mass number
  MeV: number;      // Energy released
  neutrino: NeutrinoType;
  nBorF1: BosonFermionType;
  aBorF1: BosonFermionType;
  nBorF2: BosonFermionType;
  aBorF2: BosonFermionType;
  nBorF: BosonFermionType;
  aBorF: BosonFermionType;
  BEin?: number;    // Input binding energy threshold
}

export interface FissionReaction {
  id: number;
  E: string;        // Input element symbol
  Z: number;        // Input atomic number
  A: number;        // Input mass number
  E1: string;       // Output element 1 symbol
  Z1: number;       // Output 1 atomic number
  A1: number;       // Output 1 mass number
  E2: string;       // Output element 2 symbol
  Z2: number;       // Output 2 atomic number
  A2: number;       // Output 2 mass number
  MeV: number;      // Energy released
  neutrino: NeutrinoType;
  nBorF: BosonFermionType;
  aBorF: BosonFermionType;
  nBorF1: BosonFermionType;
  aBorF1: BosonFermionType;
  nBorF2: BosonFermionType;
  aBorF2: BosonFermionType;
  BEin?: number;
}

export interface TwoToTwoReaction {
  id: number;
  E1: string;       // Input element 1
  Z1: number;
  A1: number;
  E2: string;       // Input element 2
  Z2: number;
  A2: number;
  E3: string;       // Output element 1
  Z3: number;
  A3: number;
  E4: string;       // Output element 2
  Z4: number;
  A4: number;
  MeV: number;
  neutrino: NeutrinoType;
  nBorF1: BosonFermionType;
  aBorF1: BosonFermionType;
  nBorF2: BosonFermionType;
  aBorF2: BosonFermionType;
  nBorF3: BosonFermionType;
  aBorF3: BosonFermionType;
  nBorF4: BosonFermionType;
  aBorF4: BosonFermionType;
  BEin?: number;
}

export type Reaction = FusionReaction | FissionReaction | TwoToTwoReaction;

export interface QueryFilter {
  elements?: string[];
  element1List?: string[];  // For E1 in fusion, E1 in two-to-two
  element2List?: string[];  // For E2 in fusion, E2 in two-to-two
  outputElementList?: string[];  // For E in fusion (output element)
  outputElement1List?: string[];  // For E1 in fission (output element 1)
  outputElement2List?: string[];  // For E2 in fission (output element 2)
  outputElement3List?: string[];  // For E3 in two-to-two (output element 3)
  outputElement4List?: string[];  // For E4 in two-to-two (output element 4)
  minMeV?: number;
  maxMeV?: number;
  neutrinoType?: NeutrinoType;
  bosonFermionFilter?: {
    nuclear?: BosonFermionType | 'either';
    atomic?: BosonFermionType | 'either';
  };
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface QueryResult<T = Reaction> {
  reactions: T[];
  nuclides: Nuclide[];
  elements: Element[];
  radioactiveNuclides: Set<string>;  // Set of "Z-A" format (e.g., "26-56") for O(1) lookup
  executionTime: number;
  rowCount: number;
  totalCount: number;  // Total matching rows without limit
}

export interface HeatmapMetrics {
  frequency: Map<string, number>;  // Element symbol → count of reaction appearances
  energy: Map<string, number>;     // Element symbol → total MeV from reactions
  diversity: Map<string, number>;  // Element symbol → count of unique isotopes
  inputOutputRatio: Map<string, { inputCount: number; outputCount: number; ratio: number }>; // Element symbol → input/output counts and ratio (0=pure input, 1=pure output)
}

export interface CascadeParameters {
  fuelNuclides: string[];
  temperature: number;
  minFusionMeV: number;
  minTwoToTwoMeV: number;
  maxNuclides: number;
  maxLoops: number;
  feedbackBosons: boolean;
  feedbackFermions: boolean;
  allowDimers: boolean;
  excludeMelted: boolean;
  excludeBoiledOff: boolean;
}

// Cascade simulation result types
export interface CascadeReaction {
  type: 'fusion' | 'twotwo';         // Reaction type
  inputs: string[];                  // Nuclide IDs (e.g., ["H-1", "Li-7"])
  outputs: string[];                 // Product nuclide IDs
  MeV: number;                       // Energy released/absorbed
  loop: number;                      // Which iteration produced this reaction (0 = initial)
  neutrino: NeutrinoType;            // Neutrino involvement
}

export interface CascadeResults {
  reactions: CascadeReaction[];                    // All reactions in cascade
  productDistribution: Map<string, number>;        // Nuclide ID → count of appearances
  nuclides: Nuclide[];                             // All nuclides involved
  elements: Element[];                             // All elements involved
  totalEnergy: number;                             // Sum of all MeV values
  loopsExecuted: number;                           // Actual loops run (may be < maxLoops)
  executionTime: number;                           // Time in milliseconds
  terminationReason: 'max_loops' | 'no_new_products' | 'max_nuclides'; // Why cascade stopped
}

// Decay chain types for multi-generation radioactive decay visualization
export interface DecayChainNode {
  nuclide: { Z: number; A: number; E: string };
  decayMode?: string;                  // Decay mode that led to this nuclide (e.g., 'A', 'B-', 'EC')
  branchingRatio?: number;             // Percentage of parent decays that lead to this daughter (0-100)
  halfLife?: number;                   // Half-life numeric value
  halfLifeUnits?: string;              // Half-life units (s, m, h, d, y)
  logHalfLife?: number;                // Log₁₀ half-life in years
  children: DecayChainNode[];          // Daughter nuclides
  depth: number;                       // Generation depth from root (0 = root)
  isStable: boolean;                   // True if LHL > 9 (half-life > 1 billion years)
}

export interface DecayChainResult {
  root: DecayChainNode;                           // Root nuclide node
  totalGenerations: number;                       // Maximum depth of the tree
  branchCount: number;                            // Total number of decay branches
  terminalNuclides: Array<{                       // Leaf nodes of the tree
    Z: number;
    A: number;
    E: string;
    isStable: boolean;
  }>;
}

// Query state persistence types for maintaining state across navigation
export interface VisualizationState {
  pinnedNuclide?: { Z: number; A: number; E: string } | null;
  pinnedElement?: { Z: number; E: string } | null;
  highlightedNuclide?: { Z: number; A: number; E: string } | null;
  highlightedElement?: { Z: number; E: string } | null;
  showHeatmap?: boolean;
  heatmapMode?: HeatmapMode;
  userTableHeight?: number;
}

export interface QueryPageState {
  // Query filters
  filter: QueryFilter;
  selectedElements?: string[];  // For generic element selection
  selectedElement1?: string[];  // For fusion/twotwo E1
  selectedElement2?: string[];  // For fusion/twotwo E2
  selectedOutputElement?: string[];  // For fusion output
  selectedOutputElement1?: string[];  // For fission output E1
  selectedOutputElement2?: string[];  // For fission output E2
  selectedOutputElement3?: string[];  // For twotwo output E3
  selectedOutputElement4?: string[];  // For twotwo output E4

  // Energy filters
  minMeV?: number;
  maxMeV?: number;

  // Additional filters
  neutrino?: NeutrinoType;
  limit?: number;

  // UI state
  showBosonFermion?: boolean;
  visualization?: VisualizationState;

  // Timestamp for cache management
  lastUpdated?: number;
}

export interface CascadePageState {
  // Cascade parameters
  temperature: number;
  minFusionMeV: number;
  minTwoToTwoMeV: number;
  maxNuclides: number;
  maxLoops: number;
  feedbackBosons: boolean;
  feedbackFermions: boolean;
  allowDimers: boolean;
  excludeMelted: boolean;
  excludeBoiledOff: boolean;

  // Fuel nuclides
  fuelNuclides: string[];

  // Simulation results (optional - only present after running simulation)
  results?: CascadeResults;

  // Timestamp for cache management
  lastUpdated?: number;
}

export interface AllQueryStates {
  fusion?: QueryPageState;
  fission?: QueryPageState;
  twotwo?: QueryPageState;
  cascade?: CascadePageState;
  version?: number;  // For future migration if state structure changes
}
