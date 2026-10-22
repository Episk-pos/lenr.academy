import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { heatmapColor, heatmapGradient } from '../utils/heatmapColor'

interface MullerHeatmapLegendProps {
  /** Which Muller periodic table the legend describes */
  variant: 'resonance' | 'nae'
}

// Resonance tab: ratio and intensity both equal the normalised match strength
const RESONANCE_STOPS = [0.15, 0.4, 0.7, 1].map(v => ({ ratio: v, intensity: v }))
// NAE tab: in-range elements span ratio/intensity 0.5 (weakest) → 1.0 (best)
const NAE_STOPS = [0.5, 0.75, 1].map(v => ({ ratio: v, intensity: v }))
// NAE tab: out-of-range elements are drawn faint blue
const NAE_OUTSIDE = { ratio: 0, intensity: 0.12 }

/**
 * Colour legend for the Muller Resonance periodic tables. Uses the same colour
 * function as PeriodicTable so swatches always match the cells, in both themes.
 */
export default function MullerHeatmapLegend({ variant }: MullerHeatmapLegendProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const stops = variant === 'nae' ? NAE_STOPS : RESONANCE_STOPS
  const lowLabel = variant === 'nae' ? t('mullerResonance.legend.naeWeaker') : t('mullerResonance.legend.weaker')
  const highLabel = variant === 'nae' ? t('mullerResonance.legend.naeBest') : t('mullerResonance.legend.stronger')

  return (
    <div
      data-testid={`muller-legend-${variant}`}
      className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {t('mullerResonance.legend.title')}:
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{lowLabel}</span>
          <div
            data-testid="muller-legend-gradient"
            className="flex-1 min-w-[60px] h-4 rounded border border-gray-200 dark:border-gray-700"
            style={{ background: heatmapGradient(stops, isDark) }}
            aria-hidden="true"
          />
          <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{highLabel}</span>
        </div>
        {variant === 'nae' && (
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <span
              data-testid="muller-legend-outside-swatch"
              className="inline-block w-4 h-4 rounded border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: heatmapColor(NAE_OUTSIDE.ratio, NAE_OUTSIDE.intensity, isDark) }}
              aria-hidden="true"
            />
            {t('mullerResonance.legend.naeOutside')}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        {variant === 'nae' ? t('mullerResonance.legend.naeUncoloured') : t('mullerResonance.legend.uncoloured')}
      </p>
    </div>
  )
}
