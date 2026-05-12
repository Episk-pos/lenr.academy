// Citation types for the annotated bibliography overlay (Issue #173)
//
// First-cut implementation: small curated dataset of documented LENR claims.
// See src/data/citations.ts for the seed entries.

export type CitationPhenomenon =
  | 'excess-heat'
  | 'he4'
  | 'tritium'
  | 'transmutation'
  | 'neutrons'
  | 'strange-radiation'
  | 'theory'
  | 'meta-analysis'
  | 'funding'
  | 'replication'

export type CitationReplicationCount = 'one' | 'few' | 'many'

/**
 * A documented LENR claim, paper, or experimental result.
 *
 * `reactionKey` and `transmutation` are the primary join keys against
 * application data. Both are optional — some citations document a phenomenon
 * (e.g., excess heat, funding) without a specific nuclear pathway.
 */
export interface Citation {
  /** Stable identifier, used for keys and cross-references. */
  id: string
  authors: string
  year: number
  title?: string
  journal?: string
  institution?: string
  doi?: string
  /** Canonical URL (LENR-CANR, DOI resolver, etc.). */
  url?: string

  /**
   * Reaction this citation documents, in canonical key form.
   * Format: `<input>+<input>-><output>` or `<input>+<input>-><output>+<output>`
   * where each side is alphabetized. Use element symbol + mass number,
   * e.g., `D-2+D-2->He-4` or `H-1+Li-7->He-4+He-4`.
   */
  reactionKey?: string

  /**
   * Element-level transmutation observation. `fromA`/`toA` are optional
   * when the citation reports the transmutation at the element level only.
   */
  transmutation?: {
    fromZ: number
    fromA?: number
    toZ: number
    toA?: number
  }

  phenomenon?: CitationPhenomenon

  /** One-sentence paraphrased summary or quote. */
  excerpt: string

  /** How widely the claim has been replicated. */
  replicationCount?: CitationReplicationCount
}
