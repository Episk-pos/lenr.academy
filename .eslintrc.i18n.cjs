// Standalone ESLint config for the i18n literal-string audit (`npm run lint:i18n`).
// Kept separate from .eslintrc.cjs so the main `npm run lint` (--max-warnings 0)
// is not affected. Reports hardcoded JSX text that should go through t().
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  // react-hooks / @typescript-eslint / react-refresh are loaded only so that existing
  // eslint-disable comments for their rules resolve; none of their rules are enabled.
  plugins: ['i18next', 'react-hooks', '@typescript-eslint', 'react-refresh'],
  // SentryTest is an unlinked developer-only diagnostics page (not user-facing)
  ignorePatterns: ['dist', '**/*.test.ts', '**/*.test.tsx', 'src/pages/SentryTest.tsx'],
  rules: {
    'i18next/no-literal-string': [
      'warn',
      {
        mode: 'jsx-only',
        // Invariant text: punctuation/numbers, ALL-CAPS codes, scientific units and symbols
        words: {
          exclude: [
            '[0-9!-/:-@[-`{-~]+',
            '[A-Z_-]+',
            /^\p{Emoji}+$/u,
            /^[\s(]*(MeV|keV|kJ\/mol|pm|amu|ppm|ms|MHz|K|W\/\(m·K\)|cm³\/mol|MS\/m|μₙ|%|×|x|Z|N|A|e|p)[\s)]*$/u,
            /^\s*[^\p{L}]*\s*$/u,
            // Tailwind class lists / CSS tokens (lowercase, contain - : [ or #)
            /^(?=.*[-:[#])[a-z0-9:\-[\]/.#% ]+$/,
          ],
        },
        // Calls whose string arguments are identifiers/keys, not UI text
        callees: {
          exclude: [
            'i18n(ext)?', 't', 'require', 'addEventListener', 'removeEventListener', 'postMessage',
            'getElementById', 'dispatch', 'commit', 'includes', 'indexOf', 'endsWith', 'startsWith',
            'set', 'get', 'has', 'delete', 'append', 'navigate', 'console\\..*', 'setItem', 'getItem',
            'removeItem', 'querySelector(All)?', 'join', 'split', 'replace(All)?', 'toLocale.*',
            'trackEvent', 'track', 'setSearchParams', 'set[A-Z].*', 'classList\\..*', 'matchMedia',
          ],
        },
        // Attributes that never carry user-visible text. Everything else (title,
        // aria-label, placeholder, alt, label, description, render props, ...)
        // is checked, including JSX nested inside render-prop attributes.
        'jsx-attributes': {
          exclude: [
            'className', 'styleName', 'style', 'type', 'key', 'id', 'width', 'height',
            'data-.*', 'htmlFor', 'name', 'value', 'defaultValue', 'to', 'href', 'src', 'rel',
            'target', 'role', 'mode', 'variant', 'size', 'align', 'position', 'colorScheme',
            'testId', 'i18nKey', 'ns', 'dataKey', 'stroke.*', 'fill.*', 'd', 'viewBox', 'x', 'y',
            'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform',
            'textAnchor', 'dominantBaseline', 'markerEnd', 'markerStart', 'clipPath', 'mask',
            'filter', 'gradientUnits', 'offset', 'stopColor', 'fontFamily', 'fontWeight',
            'inputMode', 'autoComplete', 'pattern', 'accept', 'method', 'layout', 'orientation',
            'interval', 'anchor', 'placement', 'side', 'storageKey', 'columnKey', 'sortKey',
            'aria-hidden', 'aria-live', 'aria-controls', 'aria-describedby', 'aria-labelledby',
            'aria-haspopup', 'aria-current', 'aria-expanded', 'aria-pressed', 'aria-orientation',
            'aria-autocomplete', 'tabIndex', 'loading', 'decoding', 'referrerPolicy', 'crossOrigin',
            'field', 'currentQueryType', 'reactionType', 'anchorX', 'anchorY',
          ],
        },
        // Object keys whose values are identifiers/CSS, not UI text
        'object-properties': {
          exclude: [
            '[A-Z_-]+', 'key', 'queryType', 'mode', 'position', 'cursor', 'height', 'width', 'overflow',
            'borderRadius', 'stroke', 'fill', 'color', 'background(Color)?', 'border(Color)?',
            'fusion', 'fission', 'twotwo', 'repository',
          ],
        },
      },
    ],
  },
}
