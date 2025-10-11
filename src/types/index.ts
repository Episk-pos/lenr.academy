// Core data types for Nanosoft nuclear transmutation tables

export type NeutrinoType = 'none' | 'left' | 'right';
export type BosonFermionType = 'b' | 'f';
export type ReactionType = 'fusion' | 'fission' | 'twotwo';

export interface Nuclide {
  id: number;
  Z: number;        // Atomic number (protons)
  A: number;        // Mass number
  E: string;        // Element symbol
  BE: number;       // Binding Energy in MeV
  AMU: number;      // Atomic mass unit
  nBorF: BosonFermionType;  // Nuclear Boson or Fermion
  aBorF: BosonFermionType;  // Atomic Boson or Fermion
  LHL?: number;     // log10 of half-life in years
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
  neutrinoTypes?: NeutrinoType[];
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
  executionTime: number;
  rowCount: number;
  totalCount: number;  // Total matching rows without limit
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
