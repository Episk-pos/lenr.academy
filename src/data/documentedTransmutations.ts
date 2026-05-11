/**
 * Documented LENR transmutation claims from primary literature.
 *
 * These are reported transmutations from peer-reviewed and conference papers.
 * Inclusion here is NOT an endorsement of mechanism — the Parkhomov database
 * may show pathways that permit these net atomic-number / mass-number changes,
 * but that does not prove the documented mechanism is correct.
 *
 * Sourced from the HumanScholars LENR literature review:
 * https://humanscholars.online/research/lenr-low-energy-nuclear-reactions
 */

export type TransmutationCategory =
  | 'solid-state'
  | 'biological'
  | 'glow-discharge'
  | 'thin-film'
  | 'co-deposition';

export interface DocumentedTransmutation {
  /** Stable, URL-safe identifier */
  id: string;
  /** Source element symbol (matches Parkhomov ElementPropertiesPlus.E) */
  fromElement: string;
  /** Optional source mass number, when the report identifies a specific isotope */
  fromA?: number;
  /** Product element symbol */
  toElement: string;
  /** Optional product mass number */
  toA?: number;
  /** Atomic number change (toZ - fromZ); must be supplied for pathway search */
  deltaZ: number;
  /** Mass number change, when both fromA and toA are known */
  deltaA?: number;
  /** Primary citation (researcher, lab, year) */
  source: string;
  /** Experimental setup summary */
  setup: string;
  /** Hypothesized mechanism advanced by the original authors */
  hypothesizedMechanism?: string;
  /** Other groups reporting replication (if any) */
  replicatedBy?: string[];
  /** Coarse experimental category for filtering */
  category: TransmutationCategory;
  /**
   * DOI or URL to the original publication, or a deterministic search URL on
   * a known LENR archive (e.g., lenr-canr.org) when a direct DOI is not
   * available with high confidence. Every entry should provide a value so the
   * UI can always render a "View source" affordance.
   */
  doiOrUrl?: string;
  /**
   * Short publication tag rendered as a chip alongside the citation
   * (e.g., "JJAP 2002", "ICCF-12"). Optional; only set when high confidence.
   */
  sourceTag?: string;
  /** Free-form notes (e.g., "tritium production, not strictly transmutation") */
  notes?: string;
}

export const DOCUMENTED_TRANSMUTATIONS: DocumentedTransmutation[] = [
  {
    id: 'iwamura-cs-pr',
    fromElement: 'Cs',
    fromA: 133,
    toElement: 'Pr',
    toA: 141,
    deltaZ: 2,
    deltaA: 8,
    source: 'Iwamura et al., Mitsubishi Heavy Industries (2002)',
    setup: 'Pd/CaO multilayer thin film with deuterium gas permeation',
    hypothesizedMechanism: 'Sequential alpha-capture: 133Cs + 2 × 4He → 141Pr',
    replicatedBy: ['Toyota Central R&D (2013)', 'Osaka University (2003)'],
    category: 'thin-film',
    doiOrUrl: 'https://doi.org/10.1143/JJAP.41.4642',
    sourceTag: 'JJAP 2002',
  },
  {
    id: 'iwamura-sr-mo',
    fromElement: 'Sr',
    fromA: 88,
    toElement: 'Mo',
    toA: 96,
    deltaZ: 4,
    deltaA: 8,
    source: 'Iwamura et al., Mitsubishi Heavy Industries (2002)',
    setup: 'Pd/CaO multilayer thin film with deuterium permeation',
    hypothesizedMechanism: 'Sequential alpha-capture: 88Sr + 2 × 4He → 96Mo',
    replicatedBy: ['Toyota Central R&D (2013)'],
    category: 'thin-film',
    doiOrUrl: 'https://doi.org/10.1143/JJAP.41.4642',
    sourceTag: 'JJAP 2002',
  },
  {
    id: 'iwamura-ba-sm',
    fromElement: 'Ba',
    fromA: 138,
    toElement: 'Sm',
    toA: 150,
    deltaZ: 6,
    deltaA: 12,
    source: 'Iwamura et al., Mitsubishi Heavy Industries (2006)',
    setup: 'Pd/CaO multilayer thin film with deuterium permeation',
    hypothesizedMechanism: 'Multi-step alpha-capture: 138Ba + 3 × 4He → 150Sm',
    category: 'thin-film',
    doiOrUrl:
      'https://jcmns.org/article/72216-recent-advances-in-deuterium-permeation-transmutation-experiments',
  },
  {
    id: 'iwamura-w-pt',
    fromElement: 'W',
    fromA: 184,
    toElement: 'Pt',
    toA: 192,
    deltaZ: 4,
    deltaA: 8,
    source: 'Iwamura et al., Mitsubishi Heavy Industries (2007)',
    setup: 'Pd/CaO multilayer thin film with deuterium permeation',
    hypothesizedMechanism: 'Sequential alpha-capture: 184W + 2 × 4He → 192Pt',
    category: 'thin-film',
    doiOrUrl:
      'https://jcmns.org/article/72216-recent-advances-in-deuterium-permeation-transmutation-experiments',
  },
  {
    id: 'vysotskii-cs-ba',
    fromElement: 'Cs',
    fromA: 137,
    toElement: 'Ba',
    toA: 138,
    deltaZ: 1,
    deltaA: 1,
    source: 'Vysotskii & Kornilova (Kiev State University, 2003)',
    setup:
      'Bacterial cultures (Deinococcus radiodurans, microbial syntrophic associations) exposed to Cs-137 contaminated growth media',
    hypothesizedMechanism:
      'Microbial-catalyzed beta-decay-like transmutation; biological coherent correlated states proposed',
    category: 'biological',
    doiOrUrl: 'https://doi.org/10.1016/j.anucene.2013.02.008',
    notes:
      'Reported reduction of Cs-137 activity correlated with Ba-138 appearance in growth medium.',
  },
  {
    id: 'vysotskii-mn-fe',
    fromElement: 'Mn',
    fromA: 55,
    toElement: 'Fe',
    toA: 57,
    deltaZ: 1,
    deltaA: 2,
    source: 'Vysotskii & Kornilova (Kiev State University, 1996-2008)',
    setup:
      'Iron-deficient microbial cultures supplemented with Mn-55 and D2O; Mössbauer spectroscopy of Fe-57 product',
    hypothesizedMechanism:
      'Net reaction proposed as 55Mn + d → 57Fe via biologically-mediated low-energy fusion',
    category: 'biological',
    doiOrUrl: 'https://doi.org/10.1016/j.anucene.2013.02.008',
  },
  {
    id: 'miley-multi-element',
    fromElement: 'Ni',
    toElement: 'Cu',
    deltaZ: 1,
    source: 'Miley & Patterson (UIUC / CETI, 1996)',
    setup:
      'Thin-film Ni cathodes electrolyzed in light-water solutions; ~50 product elements detected by SIMS/NAA',
    hypothesizedMechanism:
      'Broad transmutation product spectrum; no single mechanism proposed (fission of compound nucleus suggested)',
    category: 'thin-film',
    doiOrUrl: 'https://www.lenr-canr.org/acrobat/MileyGHnucleartra.pdf',
    notes:
      'Catch-all entry: Miley reported a wide product distribution. Ni→Cu used here as the most-cited single pair; ~50 elements were observed.',
  },
  {
    id: 'savvatimova-pd-ag',
    fromElement: 'Pd',
    fromA: 106,
    toElement: 'Ag',
    toA: 107,
    deltaZ: 1,
    deltaA: 1,
    source: 'Savvatimova et al. (Luch, Russia, 1990s-2000s)',
    setup: 'Glow-discharge bombardment of Pd cathodes in deuterium plasma',
    hypothesizedMechanism:
      'Multiple pathways proposed including neutron-like processes and electron-screened weak interaction',
    category: 'glow-discharge',
    doiOrUrl:
      'https://jcmns.org/article/72170-transmutation-of-elements-in-low-energy-glow-discharge-and-the-associated-processes',
    notes: 'Savvatimova reported Pd → Rh, Ru, Ag, Cd; Pd→Ag captured here.',
  },
  {
    id: 'savvatimova-pd-rh',
    fromElement: 'Pd',
    fromA: 105,
    toElement: 'Rh',
    toA: 103,
    deltaZ: -1,
    deltaA: -2,
    source: 'Savvatimova et al. (Luch, Russia, 1990s-2000s)',
    setup: 'Glow-discharge bombardment of Pd cathodes in deuterium plasma',
    hypothesizedMechanism: 'Net loss of (p + 2n) reported; mechanism unresolved',
    category: 'glow-discharge',
    doiOrUrl:
      'https://jcmns.org/article/72170-transmutation-of-elements-in-low-energy-glow-discharge-and-the-associated-processes',
  },
  {
    id: 'spawar-tritium',
    fromElement: 'D',
    fromA: 2,
    toElement: 'T',
    toA: 3,
    deltaZ: 0,
    deltaA: 1,
    source: 'Mosier-Boss et al., SPAWAR Systems Center (2007-2009)',
    setup:
      'Pd/D co-deposition on Au or Ag substrate; CR-39 detectors record charged-particle tracks; tritium accumulation measured',
    hypothesizedMechanism:
      'D + D → T + p reported; not strictly elemental transmutation but an anomalous nuclear process',
    category: 'co-deposition',
    doiOrUrl: 'https://doi.org/10.1007/s00114-008-0449-x',
    notes:
      'Included as a reference anomalous-nuclear-process claim. Net transmutation is D → T (neutron capture-like).',
  },
];
