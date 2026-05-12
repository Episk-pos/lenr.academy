import katex from 'katex'
import { toLatex } from './nuclideEquation.utils'

type Props = {
  /** Expression string, e.g. "133Cs + 2 × 4He → 141Pr" or "55Mn + d → 57Fe" */
  input: string
  /** Render in display mode (block, larger). Defaults to inline. */
  displayMode?: boolean
  className?: string
}

/**
 * Render an isotope equation expressed in the project's loose notation as
 * proper math via KaTeX. The string-to-LaTeX conversion lives in
 * `nuclideEquation.utils.ts` and is exported there for direct testing.
 */
export default function NuclideEquation({
  input,
  displayMode = false,
  className,
}: Props) {
  const latex = toLatex(input)
  const html = katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    output: 'html',
  })

  if (displayMode) {
    return (
      <div
        className={className}
        // KaTeX output is trusted — derived from a fixed parser over our own
        // data, no user input.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
