// Annotated LENR bibliography (Issue #173, beads lenr-hy0).
//
// First-cut seed dataset. Excerpts are paraphrased from documented
// summaries — verify against primary sources before quoting in publication.
// Sourced from analysis of the HumanScholars LENR literature review:
// https://humanscholars.online/research/lenr-low-energy-nuclear-reactions

import type { Citation } from '../types/citations'

export const citations: Citation[] = [
  // ─── Excess heat / electrolytic ───────────────────────────────────────────
  {
    id: 'fleischmann-pons-1989',
    doi: '10.1016/0022-0728(89)80006-3',
    authors: 'Fleischmann, M. & Pons, S.',
    year: 1989,
    title: 'Electrochemically induced nuclear fusion of deuterium',
    journal: 'J. Electroanal. Chem. 261, 301',
    phenomenon: 'excess-heat',
    excerpt:
      'Reported anomalous excess heat (up to ~26 MJ per mole Pd) in heavy-water electrolysis at Pd cathodes, kicking off the field.',
    replicationCount: 'many',
  },
  {
    id: 'fleischmann-1992-heat-after-death',
    url: 'https://lenr-canr.org/acrobat/PonsSheatafterd.pdf',
    authors: 'Fleischmann, M.',
    year: 1992,
    institution: 'IMRA Europe',
    phenomenon: 'excess-heat',
    excerpt:
      '"Heat-after-death" — anomalous heat persists after electrolysis current is cut off, observed in Pd/D₂O cells (1992–1994).',
    replicationCount: 'few',
  },
  {
    id: 'mckubre-1990-loading-ratio',
    url: 'https://lenr-canr.org/acrobat/McKubreMCHexcesspowe.pdf',
    authors: 'McKubre, M. C. H. et al.',
    year: 1994,
    institution: 'SRI International',
    phenomenon: 'excess-heat',
    excerpt:
      'Established that a deuterium loading ratio x = D/Pd > ~0.9 is a prerequisite for reproducible excess heat in Pd cathodes (1990–2002).',
    replicationCount: 'many',
  },

  // ─── He-4 correlated with heat ────────────────────────────────────────────
  {
    id: 'miles-1990-he4',
    doi: '10.1016/0022-0728(93)85006-3',
    authors: 'Miles, M. et al.',
    year: 1993,
    institution: 'Naval Air Warfare Center, China Lake',
    phenomenon: 'he4',
    reactionKey: 'D-2+D-2->He-4',
    excerpt:
      'Detected ⁴He in Pd/D₂O cell effluent gas correlated with excess heat at Q/N(⁴He) ≈ 23.8 MeV — the d+d → ⁴He fusion Q-value.',
    replicationCount: 'many',
  },
  {
    id: 'hubler-violante-2014',
    url: 'https://www.currentscience.ac.in/Volumes/108/04/0540.pdf',
    authors: 'Hubler, G. K. & Violante, V.',
    year: 2014,
    title: 'Anomalous effects in deuterium/metal systems',
    journal: 'Current Science 108, 494',
    phenomenon: 'meta-analysis',
    reactionKey: 'D-2+D-2->He-4',
    excerpt:
      'Meta-analysis of ~20 independent groups reporting heat-correlated ⁴He production with consistent Q/N(⁴He) ≈ 24 MeV.',
    replicationCount: 'many',
  },

  // ─── Plasma electrolysis / Ni-H ───────────────────────────────────────────
  {
    id: 'mizuno-2000-plasma',
    doi: '10.1143/JJAP.39.6055',
    authors: 'Mizuno, T.',
    year: 2000,
    institution: 'Hokkaido University, Japan',
    phenomenon: 'excess-heat',
    excerpt:
      'Reported COP ~5–10 in Ni-mesh hydrogen-gas-discharge variants of plasma electrolysis cells.',
    replicationCount: 'few',
  },
  {
    id: 'cleanplanet-tohoku-2024',
    doi: '10.35848/1347-4065/ad2622',
    authors: 'Iwamura, Y. et al. (Tohoku U. / Clean Planet)',
    year: 2024,
    institution: 'Tohoku University & Clean Planet Inc.',
    phenomenon: 'excess-heat',
    excerpt:
      'Reproducible net-positive-energy runs in H₂-fueled nano-Pd multilayer thin films (2024 demonstration runs).',
    replicationCount: 'few',
  },

  // ─── Tritium ──────────────────────────────────────────────────────────────
  {
    id: 'barc-1989-tritium',
    url: 'https://lenr-canr.org/acrobat/IyengarPKbhabhaatom.pdf',
    authors: 'Bhabha Atomic Research Centre teams',
    year: 1989,
    institution: 'BARC, India',
    phenomenon: 'tritium',
    excerpt:
      '12 BARC research teams independently detected tritium production in deuterated cells between 1989 and 1994.',
    replicationCount: 'many',
  },
  {
    id: 'spawar-2002-triple-tracks',
    doi: '10.1007/s00114-008-0449-x',
    authors: 'Mosier-Boss, P. A. et al. (SPAWAR)',
    year: 2007,
    institution: 'SPAWAR Systems Center, San Diego',
    phenomenon: 'tritium',
    excerpt:
      'CR-39 plastic detector evidence of triton-recoil "triple-tracks" in Pd/D co-deposition experiments (2002–2011).',
    replicationCount: 'few',
  },

  // ─── Transmutation: Iwamura series ────────────────────────────────────────
  {
    id: 'iwamura-2002-cs-pr',
    doi: '10.1143/JJAP.41.4642',
    authors: 'Iwamura, Y. et al.',
    year: 2002,
    title:
      'Elemental analysis of Pd complexes: effects of D₂ gas permeation',
    journal: 'Jpn. J. Appl. Phys. 41, 4642',
    institution: 'Mitsubishi Heavy Industries',
    phenomenon: 'transmutation',
    transmutation: { fromZ: 55, fromA: 133, toZ: 59, toA: 141 },
    excerpt:
      'Cs-133 → Pr-141 transmutation (ΔZ = +4, ΔA = +8) observed during D₂ permeation through Pd/CaO multilayer thin films.',
    replicationCount: 'few',
  },
  {
    id: 'iwamura-2002-sr-mo',
    doi: '10.1143/JJAP.41.4642',
    authors: 'Iwamura, Y. et al.',
    year: 2002,
    journal: 'Jpn. J. Appl. Phys. 41, 4642',
    institution: 'Mitsubishi Heavy Industries',
    phenomenon: 'transmutation',
    transmutation: { fromZ: 38, toZ: 42 },
    excerpt:
      'Sr → Mo transmutation (ΔZ = +4) reported in the same Pd/CaO multilayer system as the Cs→Pr result.',
    replicationCount: 'few',
  },
  {
    id: 'iwamura-2002-w-pt',
    url: 'https://jcmns.org/article/72216-recent-advances-in-deuterium-permeation-transmutation-experiments',
    authors: 'Iwamura, Y. et al.',
    year: 2006,
    institution: 'Mitsubishi Heavy Industries',
    phenomenon: 'transmutation',
    transmutation: { fromZ: 74, toZ: 78 },
    excerpt:
      'W → Pt transmutation reported in Mitsubishi Pd-multilayer experiments.',
    replicationCount: 'one',
  },
  {
    id: 'toyota-2013-replication',
    doi: '10.7567/JJAP.52.107301',
    authors: 'Hioki, T. et al. (Toyota Central R&D)',
    year: 2013,
    institution: 'Toyota Central R&D Labs',
    phenomenon: 'replication',
    transmutation: { fromZ: 55, fromA: 133, toZ: 59, toA: 141 },
    excerpt:
      'Independent replication of the Iwamura Cs → Pr transmutation result at Toyota Central R&D (also at Osaka U., 2003).',
    replicationCount: 'few',
  },

  // ─── Biological transmutation (Vysotskii) ─────────────────────────────────
  {
    id: 'vysotskii-1996-cs-ba',
    doi: '10.1016/j.anucene.2013.02.008',
    authors: 'Vysotskii, V. I. & Kornilova, A. A.',
    year: 2003,
    title: 'Nuclear Transmutation of Stable and Radioactive Isotopes in Biological Systems',
    phenomenon: 'transmutation',
    transmutation: { fromZ: 55, fromA: 137, toZ: 56, toA: 138 },
    excerpt:
      'Cs-137 → Ba-138 conversion in microbial cultures, reducing radioactivity (1996 onwards).',
    replicationCount: 'few',
  },
  {
    id: 'vysotskii-mn-fe',
    doi: '10.1016/j.anucene.2013.02.008',
    authors: 'Vysotskii, V. I. & Kornilova, A. A.',
    year: 2010,
    phenomenon: 'transmutation',
    transmutation: { fromZ: 25, toZ: 26 },
    excerpt:
      'Mn → Fe transmutation observed during microorganism metabolism in growth-medium experiments.',
    replicationCount: 'few',
  },

  // ─── Multi-element & glow-discharge transmutation ─────────────────────────
  {
    id: 'miley-1996-multi-element',
    url: 'https://www.lenr-canr.org/acrobat/MileyGHnucleartra.pdf',
    authors: 'Miley, G. H. & Patterson, J. A.',
    year: 1996,
    institution: 'University of Illinois Urbana-Champaign',
    phenomenon: 'transmutation',
    excerpt:
      'Approximately 50 elements detected on Ni cathodes after light-water electrolysis, including products absent from initial materials.',
    replicationCount: 'few',
  },
  {
    id: 'savvatimova-pd-products',
    doi: '10.70923/001c.72170',
    authors: 'Savvatimova, I. B.',
    year: 2008,
    institution: 'LUCH Scientific-Industrial Association',
    phenomenon: 'transmutation',
    transmutation: { fromZ: 46, toZ: 47 },
    excerpt:
      'Pd → Rh, Ru, Ag, Cd transmutation products identified by SIMS in glow-discharge experiments (1994–2010).',
    replicationCount: 'few',
  },

  // ─── Theory ───────────────────────────────────────────────────────────────
  {
    id: 'takahashi-tsc-theory',
    doi: '10.70923/001c.72286',
    authors: 'Takahashi, A.',
    year: 2009,
    institution: 'Osaka University',
    phenomenon: 'theory',
    reactionKey: 'D-2+D-2->He-4',
    excerpt:
      'Tetrahedral Symmetric Condensate (TSC) model predicts aneutronic 4D → ⁸Be* → 2 ⁴He + 47.6 MeV reaction pathway.',
    replicationCount: 'one',
  },

  // ─── Strange / anomalous radiation ────────────────────────────────────────
  {
    id: 'urutskoev-2002-strange-radiation',
    url: 'https://arxiv.org/abs/physics/0101089',
    authors: 'Urutskoev, L. I. et al.',
    year: 2002,
    institution: 'RECOM (Russia)',
    phenomenon: 'strange-radiation',
    excerpt:
      'Anomalous CR-39 track patterns observed after Ti-foil electrical-discharge experiments — interpreted as "strange radiation" (2000–2004).',
    replicationCount: 'few',
  },

  // ─── Funding / institutional ──────────────────────────────────────────────
  {
    id: 'arpa-e-2023-lenr',
    authors: 'ARPA-E',
    year: 2023,
    institution: 'U.S. Department of Energy ARPA-E',
    phenomenon: 'funding',
    url: 'https://arpa-e.energy.gov/',
    excerpt:
      'ARPA-E announced ~$10M in exploratory LENR research funding in 2023, signalling renewed institutional interest.',
    replicationCount: 'one',
  },
]

/** Lookup table by id for O(1) resolution. */
export const citationById: Record<string, Citation> = Object.fromEntries(
  citations.map((c) => [c.id, c])
)
