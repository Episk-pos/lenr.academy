export interface GlossaryEntry {
  term: string;
  definition: string;
  category: 'nuclear' | 'reaction' | 'database' | 'measurement';
  relatedTerms?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  // Nuclear physics concepts
  {
    term: 'Nuclide',
    definition: 'A specific nuclear species characterized by its atomic number (Z) and mass number (A). For example, Carbon-12 and Carbon-14 are different nuclides of the same element.',
    category: 'nuclear',
    relatedTerms: ['Isotope', 'Atomic Number (Z)', 'Mass Number (A)'],
  },
  {
    term: 'Isotope',
    definition: 'Atoms of the same element (same Z) with different numbers of neutrons (different A). For example, H-1 (protium), H-2 (deuterium), and H-3 (tritium) are isotopes of hydrogen.',
    category: 'nuclear',
    relatedTerms: ['Nuclide', 'Neutron'],
  },
  {
    term: 'Atomic Number (Z)',
    definition: 'The number of protons in a nucleus. Determines which element the atom is. For example, Z=1 is hydrogen, Z=26 is iron.',
    category: 'nuclear',
    relatedTerms: ['Mass Number (A)', 'Element'],
  },
  {
    term: 'Mass Number (A)',
    definition: 'The total number of protons and neutrons (nucleons) in a nucleus. A = Z + N, where N is the neutron count.',
    category: 'nuclear',
    relatedTerms: ['Atomic Number (Z)', 'Nucleon'],
  },
  {
    term: 'Binding Energy (BE)',
    definition: 'The energy required to disassemble a nucleus into its constituent protons and neutrons. Higher binding energy per nucleon means a more stable nucleus. Measured in MeV.',
    category: 'nuclear',
    relatedTerms: ['MeV', 'Binding Energy per Nucleon (BEN)'],
  },
  {
    term: 'Binding Energy per Nucleon (BEN)',
    definition: 'Binding energy divided by mass number (BE/A). Iron-56 has the highest BEN (~8.8 MeV), making it the most tightly bound nucleus. Reactions moving toward Fe-56 release energy.',
    category: 'nuclear',
    relatedTerms: ['Binding Energy (BE)', 'MeV'],
  },
  {
    term: 'Half-Life',
    definition: 'The time required for half of a radioactive sample to decay. Ranges from fractions of a second to billions of years. In this database, a nuclide with log₁₀(half-life in years) > 9 is considered stable.',
    category: 'nuclear',
    relatedTerms: ['Radioactive Decay', 'Stable Nuclide'],
  },
  {
    term: 'Stable Nuclide',
    definition: 'A nuclide that does not undergo radioactive decay (or has a half-life exceeding 1 billion years). In this database, stability is defined as LHL > 9.',
    category: 'nuclear',
    relatedTerms: ['Half-Life', 'Radioactive Decay'],
  },
  {
    term: 'Boson',
    definition: 'A particle with integer spin (0, 1, 2...). Nuclides with even mass number A are nuclear bosons. Bosons can occupy the same quantum state, enabling phenomena like Bose-Einstein condensation.',
    category: 'nuclear',
    relatedTerms: ['Fermion', 'nBorF', 'aBorF'],
  },
  {
    term: 'Fermion',
    definition: 'A particle with half-integer spin (1/2, 3/2...). Nuclides with odd mass number A are nuclear fermions. Fermions obey the Pauli exclusion principle.',
    category: 'nuclear',
    relatedTerms: ['Boson', 'nBorF', 'aBorF'],
  },
  {
    term: 'Neutrino',
    definition: 'A nearly massless, weakly interacting subatomic particle produced in nuclear reactions involving the weak force (e.g., beta decay). Denoted ν (left-handed) or ν̄ (right-handed antineutrino).',
    category: 'nuclear',
    relatedTerms: ['Beta Decay', 'Weak Force'],
  },
  {
    term: 'Radioactive Decay',
    definition: 'The spontaneous transformation of an unstable nucleus into a more stable configuration. Common modes include alpha (A), beta-minus (B-), beta-plus (B+), electron capture (EC), and isomeric transition (IT).',
    category: 'nuclear',
    relatedTerms: ['Alpha Decay', 'Beta Decay', 'Half-Life'],
  },
  {
    term: 'Alpha Decay',
    definition: 'Emission of a helium-4 nucleus (2 protons + 2 neutrons). Reduces Z by 2 and A by 4. Common in heavy elements like uranium and radium.',
    category: 'nuclear',
    relatedTerms: ['Radioactive Decay', 'Beta Decay'],
  },
  {
    term: 'Beta Decay',
    definition: 'Transformation of a neutron into a proton (β⁻, Z+1) or proton into neutron (β⁺, Z-1). A stays the same. Involves emission of a neutrino or antineutrino.',
    category: 'nuclear',
    relatedTerms: ['Radioactive Decay', 'Alpha Decay', 'Neutrino'],
  },
  {
    term: 'Electron Capture (EC)',
    definition: 'An inner orbital electron is captured by the nucleus, converting a proton to a neutron. Z decreases by 1, A stays the same. Competes with β⁺ decay.',
    category: 'nuclear',
    relatedTerms: ['Beta Decay', 'Radioactive Decay'],
  },
  {
    term: 'Isomeric Transition (IT)',
    definition: 'A metastable excited nuclear state decays to a lower energy state by emitting a gamma ray. Z and A remain unchanged. The nuclide symbol gets an "m" suffix (e.g., Tc-99m).',
    category: 'nuclear',
    relatedTerms: ['Radioactive Decay'],
  },

  // Reaction types
  {
    term: 'LENR',
    definition: 'Low Energy Nuclear Reactions. A class of nuclear reactions that occur at or near room temperature, distinct from conventional "hot" fusion which requires millions of degrees. Also historically known as "cold fusion."',
    category: 'reaction',
    relatedTerms: ['Transmutation', 'Fusion', 'Fission'],
  },
  {
    term: 'Transmutation',
    definition: 'The conversion of one chemical element or isotope into another. Can occur through fusion, fission, or two-to-two reactions. This database catalogs transmutation pathways computed by Dr. Alexander Parkhomov.',
    category: 'reaction',
    relatedTerms: ['LENR', 'Fusion', 'Fission'],
  },
  {
    term: 'Fusion',
    definition: 'A nuclear reaction where two lighter nuclei combine to form a heavier nucleus (A + B → C). Releases energy when the product has higher binding energy per nucleon than the reactants. This database contains 1,389 fusion reactions.',
    category: 'reaction',
    relatedTerms: ['Fission', 'Two-to-Two', 'MeV'],
  },
  {
    term: 'Fission',
    definition: 'A nuclear reaction where a heavier nucleus splits into two lighter nuclei (A → B + C). Releases energy when the products have higher binding energy per nucleon. This database contains 817 fission reactions.',
    category: 'reaction',
    relatedTerms: ['Fusion', 'Two-to-Two', 'MeV'],
  },
  {
    term: 'Two-to-Two',
    definition: 'A nuclear reaction where two nuclei interact and produce two different nuclei (A + B → C + D). The most common reaction type in the database with 516,789 reactions.',
    category: 'reaction',
    relatedTerms: ['Fusion', 'Fission'],
  },
  {
    term: 'Cascade',
    definition: 'A chain of nuclear reactions where products of one reaction become inputs to subsequent reactions. The cascade engine simulates multi-generation reaction pathways from initial fuel nuclides.',
    category: 'reaction',
    relatedTerms: ['Feedback Loop', 'Transmutation'],
  },
  {
    term: 'Feedback Loop',
    definition: 'When a product nuclide from a later reaction step reappears as an input in an earlier step, creating a self-sustaining cycle. Similar to the CNO cycle in stellar nucleosynthesis.',
    category: 'reaction',
    relatedTerms: ['Cascade'],
  },

  // Measurement units
  {
    term: 'MeV',
    definition: 'Megaelectronvolt (10⁶ eV). A unit of energy commonly used in nuclear physics. 1 MeV = 1.602 × 10⁻¹³ joules. The energy released in a nuclear reaction is the Q-value, measured in MeV.',
    category: 'measurement',
    relatedTerms: ['Binding Energy (BE)', 'keV'],
  },
  {
    term: 'keV',
    definition: 'Kiloelectronvolt (10³ eV). 1 MeV = 1000 keV. Used for decay energies and radiation energies in the RadioNuclides table.',
    category: 'measurement',
    relatedTerms: ['MeV'],
  },
  {
    term: 'AMU',
    definition: 'Atomic Mass Unit. Defined as 1/12 of the mass of a Carbon-12 atom. 1 AMU = 931.494 MeV/c². Used to express nuclear and atomic masses.',
    category: 'measurement',
    relatedTerms: ['Mass Number (A)'],
  },

  // Database-specific terms
  {
    term: 'nBorF',
    definition: 'Nuclear Boson or Fermion classification. Based on mass number A: even A = boson (b), odd A = fermion (f). Relevant to quantum statistical behavior of the nucleus.',
    category: 'database',
    relatedTerms: ['aBorF', 'Boson', 'Fermion'],
  },
  {
    term: 'aBorF',
    definition: 'Atomic Boson or Fermion classification. Based on neutron count (A - Z): even neutrons = boson (b), odd neutrons = fermion (f). Describes the quantum statistics of the whole atom.',
    category: 'database',
    relatedTerms: ['nBorF', 'Boson', 'Fermion'],
  },
  {
    term: 'LHL',
    definition: 'Log₁₀ of Half-Life in years. A compact representation of half-life. LHL = 0 means 1 year, LHL = 9 means 1 billion years (stable threshold). Negative values indicate sub-year half-lives.',
    category: 'database',
    relatedTerms: ['Half-Life', 'Stable Nuclide'],
  },
  {
    term: 'SUS',
    definition: 'Status field indicating nuclide origin. SPN = Stable Primordial (exists naturally), UPN = Unstable Primordial (radioactive but natural), SYN = Synthetic (only man-made).',
    category: 'database',
    relatedTerms: ['Stable Nuclide', 'Radioactive Decay'],
  },
  {
    term: 'RDM',
    definition: 'Primary Radioactive Decay Mode. The dominant decay pathway for unstable nuclides. Values include A (alpha), B- (beta minus), B+ (beta plus), EC (electron capture), IT (isomeric transition).',
    category: 'database',
    relatedTerms: ['Radioactive Decay', 'Alpha Decay', 'Beta Decay'],
  },
  {
    term: 'Deuterium (D)',
    definition: 'Hydrogen-2 (one proton + one neutron). In the database, deuterium uses the symbol "D" rather than "H" with A=2. Important in LENR research as a common fuel choice.',
    category: 'database',
    relatedTerms: ['Tritium (T)', 'Protium (H)'],
  },
  {
    term: 'Tritium (T)',
    definition: 'Hydrogen-3 (one proton + two neutrons). Radioactive with a half-life of 12.3 years. In the database, tritium uses the symbol "T" rather than "H" with A=3.',
    category: 'database',
    relatedTerms: ['Deuterium (D)', 'Protium (H)'],
  },
  {
    term: 'Protium (H)',
    definition: 'Hydrogen-1 (one proton, no neutrons). The most common hydrogen isotope (99.98% abundance). In the database, uses symbol "H".',
    category: 'database',
    relatedTerms: ['Deuterium (D)', 'Tritium (T)'],
  },
];

export const GLOSSARY_CATEGORIES = {
  nuclear: 'help.category.nuclear',
  reaction: 'help.category.reaction',
  database: 'help.category.database',
  measurement: 'help.category.measurement',
} as const;
