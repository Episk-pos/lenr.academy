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
  weight?: number;                   // Weighted probability (0-1) based on fuel proportions
}

export interface CascadeResults {
  reactions: CascadeReaction[];                    // All reactions in cascade
  productDistribution: Map<string, number>;        // Nuclide ID → count (unweighted) or weighted sum
  nuclides: Nuclide[];                             // All nuclides involved
  elements: Element[];                             // All elements involved
  totalEnergy: number;                             // Sum of all MeV values (unweighted)
  loopsExecuted: number;                           // Actual loops run (may be < maxLoops)
  executionTime: number;                           // Time in milliseconds
  terminationReason: 'max_loops' | 'no_new_products' | 'max_nuclides'; // Why cascade stopped
  // Weighted mode fields (Issue #96)
  weightedFuel?: WeightedNuclide[];                // Fuel proportions used (if weighted mode)
  useWeightedMode?: boolean;                       // Whether weighted analysis should be applied
  weightedEnergy?: number;                         // Weighted sum of MeV values (only in weighted mode)
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

  // Weighted fuel proportions (Issue #96)
  weightedFuel?: WeightedNuclide[];
  proportionFormat?: ProportionFormat;
  useWeightedMode?: boolean;

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
  cycleDiscovery?: CycleDiscoveryPageState;
  version?: number;  // For future migration if state structure changes
}

// ============================================================================
// Weighted Fuel Proportions Types (Issue #96)
// ============================================================================

/**
 * How the proportion was set - manual input, from a material, or natural abundance
 */
export type ProportionSourceType = 'manual' | 'material' | 'natural';

/**
 * Input format for specifying proportions
 */
export type ProportionFormat = 'percentage' | 'atomic-ratio' | 'mass-ratio';

/**
 * Source for isotopic abundance data
 * - 'parkhomov': Original Parkhomov database (pcaNCrust field, older IUPAC evaluation)
 * - 'iaea': IAEA Nuclear Data Services (NuBase 2020 / CIAAW current evaluation)
 */
export type AbundanceSource = 'parkhomov' | 'iaea';

/**
 * A fuel nuclide with its proportion in the mixture
 */
export interface WeightedNuclide {
  nuclideId: string;                    // e.g., "Li-7", "Ni-58", "H-1"
  proportion: number;                   // 0-100 percentage (normalized internally)
  sourceType?: ProportionSourceType;    // How this proportion was set
}

/**
 * Extended cascade parameters with weighted fuel support
 */
export interface CascadeParametersV2 extends CascadeParameters {
  weightedFuel?: WeightedNuclide[];     // Proportional fuel input
  proportionFormat?: ProportionFormat;  // How proportions were entered
  useWeightedMode?: boolean;            // Toggle weighted vs equal-weight mode
  monteCarloIterations?: number;        // For Monte Carlo sampling (default: 1000)
}

/**
 * Pathway analysis with weighted statistics
 * Mirrors PathwayAnalysis from pathwayAnalyzer.ts with additional weighted fields
 */
export interface WeightedPathwayAnalysis {
  // Base pathway fields (mirrors PathwayAnalysis)
  pathway: string;                      // Human-readable: "H-1 + Li-7 → He-4"
  type: 'fusion' | 'twotwo';
  inputs: string[];
  outputs: string[];
  frequency: number;                    // Raw count of occurrences
  avgEnergy: number;                    // Average MeV per occurrence
  totalEnergy: number;                  // Total MeV across all occurrences
  loops: number[];                      // Which loop numbers this pathway appears in
  isFeedback: boolean;                  // Does an output become an input later?
  rarityScore: number;                  // 0-100, where 100 = most common pathway

  // Weighted statistics
  weightedFrequency: number;            // Frequency adjusted by input proportions
  weightedTotalEnergy: number;          // Energy weighted by proportions
  inputContributions: Record<string, number>;  // Which fuel nuclides contributed and by how much
}

/**
 * Monte Carlo sampling statistics
 */
export interface SamplingStats {
  iterations: number;                   // Number of Monte Carlo iterations run
  convergenceMetric: number;            // Statistical convergence measure (0-1)
}

/**
 * Extended cascade results with weighted pathway analysis
 */
export interface CascadeResultsV2 extends CascadeResults {
  weightedPathways?: WeightedPathwayAnalysis[];  // Pathway analysis with weighted stats
  proportionNormalized?: WeightedNuclide[];      // Actual proportions used (normalized)
  samplingStats?: SamplingStats;                 // Monte Carlo sampling statistics
}

// ============================================================================
// Materials Catalog Types (Issue #96)
// ============================================================================

/**
 * Category of material in the catalog
 */
export type MaterialCategory =
  | 'natural-abundance'   // Natural isotopic abundances for an element
  | 'alloy'               // Metal alloys (stainless steel, bronze, etc.)
  | 'compound'            // Chemical compounds (LiAlH4, NaBH4, etc.)
  | 'lenr-experiment'     // Historical LENR experiment fuel compositions
  | 'custom';             // User-defined custom mixtures

/**
 * A single nuclide component in a material composition
 */
export interface MaterialComposition {
  nuclideId: string;                    // e.g., "Li-7", "Fe-56"
  proportion: number;                   // Percentage (0-100)
}

/**
 * A material definition for the catalog
 */
export interface Material {
  id: string;                           // Unique identifier
  name: string;                         // Display name (e.g., "Natural Lithium")
  category: MaterialCategory;
  description: string;                  // Brief description
  composition: MaterialComposition[];   // Nuclide proportions
  source?: string;                      // Citation or reference URL
  isCustom?: boolean;                   // True if user-created
  createdAt?: number;                   // Timestamp for custom materials
  tags?: string[];                      // Search tags
}

/**
 * Extended material type for historical LENR experiments
 */
export interface LENRExperiment extends Material {
  researcher: string;                   // Primary researcher name
  year?: number;                        // Year of experiment
  citation?: string;                    // Full citation or DOI
  experimentType?: string;              // Type of experiment (e.g., "Ni-H", "Pd-D")
}

/**
 * Extended cascade page state with weighted fuel support
 */
export interface CascadePageStateV2 extends CascadePageState {
  // Weighted fuel proportions
  weightedFuel?: WeightedNuclide[];
  proportionFormat?: ProportionFormat;
  useWeightedMode?: boolean;
  monteCarloIterations?: number;

  // Materials catalog state
  selectedMaterialId?: string;          // Currently selected material

  // Extended results
  results?: CascadeResultsV2;
}

// ============================================================================
// Query History & Bookmarks Types (Issue #22)
// ============================================================================

export interface SavedQuery {
  id: string;
  name: string;
  queryType: 'fusion' | 'fission' | 'twotwo';
  filter: QueryFilter;
  timestamp: number;
  isBookmarked: boolean;
  resultCount?: number;
}

// ============================================================================
// Cycle Discovery Types (Issue #92)
// ============================================================================

/**
 * Parameters controlling the cycle discovery search
 */
export interface CycleDiscoveryParameters {
  minFusionMeV: number;          // Minimum energy for fusion reactions (default: 1.0)
  minTwoToTwoMeV: number;        // Minimum energy for 2->2 reactions (default: 0.5)
  maxCycleDepth: number;          // Maximum reactions in a cycle (3-10, default: 6)
  includeFission: boolean;        // Include fission reactions (default: false)
  minFissionMeV?: number;         // Minimum energy for fission (when enabled)
  elementFilters?: {
    abundantOnly?: boolean;       // Only include naturally abundant nuclides
    excludeRadioactive?: boolean; // Exclude radioactive nuclides (logHalfLife <= 9)
    allowedElements?: string[];   // Restrict search to these elements
  };
  maxCycles: number;              // Max cycles to return (default: 100)
}

/**
 * A single reaction step within a discovered cycle
 */
export interface CycleReaction {
  type: 'fusion' | 'twotwo' | 'fission';
  inputs: Array<{ E: string; Z: number; A: number }>;
  outputs: Array<{ E: string; Z: number; A: number }>;
  MeV: number;
  isFeedback: boolean;           // True if this reaction's output regenerates a catalyst
}

/**
 * A discovered catalytic or self-sustaining cycle
 */
export interface DiscoveredCycle {
  id: string;                     // Unique identifier (hash of reactions)
  fuelNuclides: Array<{ E: string; Z: number; A: number }>;
  reactions: CycleReaction[];
  totalEnergy: number;            // Sum of MeV across all reactions
  feedbackRatio: number;          // 0-100, percentage of reactions that are feedback
  cycleDepth: number;             // Number of reactions in the cycle
  abundanceScore: number;         // 0-100, based on solar ppm
  stabilityScore: number;         // 0-100, fraction of stable nuclides
}

/**
 * Results from a cycle discovery search
 */
export interface CycleDiscoveryResults {
  cycles: DiscoveredCycle[];
  executionTime: number;
  totalCyclesFound: number;
}

/**
 * Progress update during cycle discovery
 */
export interface CycleDiscoveryProgress {
  phase: 'building_graph' | 'searching_cycles' | 'ranking';
  cyclesFound: number;
  fuelCombinationsChecked: number;
  totalCombinations: number;
  percentage: number;
}

/**
 * State persistence for the cycle discovery page
 */
export interface CycleDiscoveryPageState {
  params: CycleDiscoveryParameters;
  results?: CycleDiscoveryResults;
  lastUpdated?: number;
}
