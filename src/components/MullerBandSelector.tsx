import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BAND_PRESETS,
  DEFAULT_CUSTOM_BAND,
  type BandId,
  type BandSelection,
} from '../services/mullerResonanceService'

const UNITS = [
  { id: 'nm', label: 'nm', factor: 1e-9 },
  { id: 'um', label: 'µm', factor: 1e-6 },
  { id: 'mm', label: 'mm', factor: 1e-3 },
  { id: 'cm', label: 'cm', factor: 1e-2 },
  { id: 'm', label: 'm', factor: 1 },
] as const

type UnitId = typeof UNITS[number]['id']

function unitFactor(unit: UnitId): number {
  return UNITS.find(u => u.id === unit)!.factor
}

/** Pick the largest unit that keeps the value ≥ 1 (falls back to nm). */
function bestUnitFor(meters: number): UnitId {
  for (let i = UNITS.length - 1; i >= 0; i--) {
    if (meters >= UNITS[i].factor * (1 - 1e-9)) return UNITS[i].id
  }
  return 'nm'
}

function formatInUnit(meters: number, unit: UnitId): string {
  return String(Number((meters / unitFactor(unit)).toPrecision(10)))
}

function parsePositive(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

const CHIPS: Array<{ id: BandId; labelKey: string }> = [
  { id: 'none', labelKey: 'mullerResonance.band.none' },
  { id: 'um', labelKey: 'mullerResonance.band.um' },
  { id: 'mm', labelKey: 'mullerResonance.band.mm' },
  { id: 'cm-m', labelKey: 'mullerResonance.band.cmM' },
  { id: 'custom', labelKey: 'mullerResonance.band.custom' },
]

interface MullerBandSelectorProps {
  value: BandSelection
  onChange: (sel: BandSelection) => void
}

/**
 * Wavelength band selector for the Muller resonance table.
 * "Ratio only" hides absolute octaves; presets / custom choose which rungs
 * of each pair's octave ladder are shown.
 */
export default function MullerBandSelector({ value, onChange }: MullerBandSelectorProps) {
  const { t } = useTranslation()
  const [unit, setUnit] = useState<UnitId>(() => bestUnitFor(value.band === 'custom' ? value.min : DEFAULT_CUSTOM_BAND.min))
  const [minText, setMinText] = useState(() => formatInUnit(value.band === 'custom' ? value.min : DEFAULT_CUSTOM_BAND.min, unit))
  const [maxText, setMaxText] = useState(() => formatInUnit(value.band === 'custom' ? value.max : DEFAULT_CUSTOM_BAND.max, unit))

  // Resync input text when the committed custom range changes from outside
  // (e.g. switching from a preset to Custom, or URL navigation), without
  // clobbering in-progress typing that already parses to the same value.
  useEffect(() => {
    if (value.band !== 'custom') return
    const f = unitFactor(unit)
    const close = (a: number | null, b: number) => a !== null && Math.abs(a * f - b) <= Math.abs(b) * 1e-9
    if (!close(parsePositive(minText), value.min)) setMinText(formatInUnit(value.min, unit))
    if (!close(parsePositive(maxText), value.max)) setMaxText(formatInUnit(value.max, unit))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.band, value.min, value.max])

  const minVal = parsePositive(minText)
  const maxVal = parsePositive(maxText)
  const invalid = value.band === 'custom' && (minVal === null || maxVal === null || minVal > maxVal)

  const commit = (minS: string, maxS: string, u: UnitId) => {
    const mn = parsePositive(minS)
    const mx = parsePositive(maxS)
    if (mn === null || mx === null || mn > mx) return
    const f = unitFactor(u)
    onChange({ band: 'custom', min: mn * f, max: mx * f })
  }

  const selectChip = (id: BandId) => {
    if (id === 'none') onChange({ band: 'none', min: 0, max: 0 })
    else if (id === 'custom') {
      // Seed custom range from the currently active band, if any
      const seed = value.band === 'none' ? DEFAULT_CUSTOM_BAND : { min: value.min, max: value.max }
      const u = bestUnitFor(seed.min)
      setUnit(u)
      setMinText(formatInUnit(seed.min, u))
      setMaxText(formatInUnit(seed.max, u))
      onChange({ band: 'custom', ...seed })
    } else onChange({ band: id, ...BAND_PRESETS[id] })
  }

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
      active
        ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500'
        : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
    }`

  const inputClass =
    'w-28 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div data-testid="muller-band-selector">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('mullerResonance.band.label')}>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-1">
          {t('mullerResonance.band.label')}:
        </span>
        {CHIPS.map(chip => (
          <button
            key={chip.id}
            type="button"
            data-testid={`band-chip-${chip.id}`}
            aria-pressed={value.band === chip.id}
            onClick={() => selectChip(chip.id)}
            className={chipClass(value.band === chip.id)}
          >
            {t(chip.labelKey)}
          </button>
        ))}
      </div>

      {value.band === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            {t('mullerResonance.band.min')}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              data-testid="band-custom-min"
              value={minText}
              aria-invalid={invalid}
              onChange={e => { setMinText(e.target.value); commit(e.target.value, maxText, unit) }}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            {t('mullerResonance.band.max')}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              data-testid="band-custom-max"
              value={maxText}
              aria-invalid={invalid}
              onChange={e => { setMaxText(e.target.value); commit(minText, e.target.value, unit) }}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            {t('mullerResonance.band.unit')}
            <select
              data-testid="band-custom-unit"
              value={unit}
              onChange={e => {
                const u = e.target.value as UnitId
                setUnit(u)
                // Keep the committed range in metres; re-express it in the new unit
                setMinText(formatInUnit(value.min, u))
                setMaxText(formatInUnit(value.max, u))
              }}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {UNITS.map(u => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </label>
          {invalid && (
            <span role="alert" className="text-xs text-red-600 dark:text-red-400">
              {t('mullerResonance.band.invalidRange')}
            </span>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {t('mullerResonance.band.hint')}
        {value.band !== 'none' && (
          <> <span data-testid="band-ladder-hint">{t('mullerResonance.band.ladderHint')}</span></>
        )}
      </p>
    </div>
  )
}
