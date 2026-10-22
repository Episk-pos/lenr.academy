import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale, RefreshCw, Percent, AlertCircle, Info } from 'lucide-react';
import type { Database } from 'sql.js';
import type { WeightedNuclide, ProportionFormat } from '../types';
import {
  validateProportions,
  normalizeProportions,
  getNaturalAbundances,
  createEqualProportions,
  formatProportion,
  type ProportionInput as ProportionInputType,
  type ValidationResult,
} from '../services/proportionService';
import { parseNuclideNotation } from '../services/isotopeService';

const FORMAT_KEYS: Record<ProportionFormat, string> = {
  percentage: 'percentage',
  'atomic-ratio': 'atomicRatio',
  'mass-ratio': 'massRatio',
};

interface ProportionInputProps {
  /** Selected nuclide IDs (e.g., ["Li-7", "Ni-58"]) */
  nuclideIds: string[];
  /** Current weighted nuclides */
  weightedNuclides: WeightedNuclide[];
  /** Callback when proportions change */
  onProportionsChange: (nuclides: WeightedNuclide[]) => void;
  /** Current format */
  format: ProportionFormat;
  /** Callback when format changes */
  onFormatChange: (format: ProportionFormat) => void;
  /** Database reference for natural abundance lookup */
  db: Database | null;
  /** Whether to auto-normalize on blur */
  autoNormalize?: boolean;
  /** Show format selector */
  showFormatSelector?: boolean;
  /** Label for the section */
  label?: string;
  /** Test ID prefix */
  testId?: string;
}

/**
 * ProportionInput Component
 *
 * Allows users to specify proportions for each fuel nuclide.
 * Supports multiple input formats (percentage, atomic ratio, mass ratio)
 * and includes quick actions for common operations.
 */
export default function ProportionInput({
  nuclideIds,
  weightedNuclides,
  onProportionsChange,
  format,
  onFormatChange,
  db,
  autoNormalize = true,
  showFormatSelector = true,
  label,
  testId = 'proportion-input',
}: ProportionInputProps) {
  // Local input values (may not be normalized yet)
  const { t } = useTranslation();
  const getFormatLabel = (fmt: ProportionFormat) => t(`proportions.formatLabel.${FORMAT_KEYS[fmt]}`);
  const getFormatHelpText = (fmt: ProportionFormat) => t(`proportions.formatHelp.${FORMAT_KEYS[fmt]}`);
  const [inputValues, setInputValues] = useState<Map<string, string>>(new Map());
  const [showTooltip, setShowTooltip] = useState(false);

  // Format proportion for display in input field
  // Uses reasonable precision: 2 decimals for values >= 1, 3 for < 1, 4 for < 0.1
  const formatForInput = (value: number): string => {
    if (value >= 1) {
      return value.toFixed(2);
    } else if (value >= 0.1) {
      return value.toFixed(3);
    } else if (value >= 0.001) {
      return value.toFixed(4);
    } else if (value === 0) {
      return '0';
    } else {
      return value.toExponential(2);
    }
  };

  // Sync input values with weighted nuclides
  useEffect(() => {
    const newValues = new Map<string, string>();
    for (const nuclide of weightedNuclides) {
      newValues.set(nuclide.nuclideId, formatForInput(nuclide.proportion));
    }
    // Add any new nuclides that aren't in weighted list
    for (const id of nuclideIds) {
      if (!newValues.has(id)) {
        // Default to equal distribution
        newValues.set(id, formatForInput(100 / nuclideIds.length));
      }
    }
    setInputValues(newValues);
  }, [weightedNuclides, nuclideIds]);

  // Build proportion inputs for validation
  const proportionInputs = useMemo((): ProportionInputType[] => {
    return nuclideIds.map((id) => ({
      nuclideId: id,
      value: parseFloat(inputValues.get(id) || '0') || 0,
    }));
  }, [nuclideIds, inputValues]);

  // Validate current inputs
  const validation = useMemo((): ValidationResult => {
    return validateProportions(proportionInputs, format);
  }, [proportionInputs, format]);

  // Calculate total for display
  const total = useMemo(() => {
    return proportionInputs.reduce((sum, p) => sum + p.value, 0);
  }, [proportionInputs]);

  // Handle individual input change
  const handleInputChange = (nuclideId: string, value: string) => {
    const newValues = new Map(inputValues);
    newValues.set(nuclideId, value);
    setInputValues(newValues);
  };

  // Handle blur - optionally normalize
  const handleInputBlur = () => {
    if (autoNormalize && validation.isValid) {
      const normalized = normalizeProportions(proportionInputs, 'manual');
      onProportionsChange(normalized);
    }
  };

  // Distribute equally
  const handleDistributeEqually = () => {
    const equal = createEqualProportions(nuclideIds, 'manual');
    onProportionsChange(equal);
  };

  // Reset to natural abundances
  const handleResetToNatural = () => {
    if (!db) return;

    // Group nuclides by element
    const elementGroups = new Map<string, string[]>();
    for (const id of nuclideIds) {
      const parsed = parseNuclideNotation(id);
      if (parsed) {
        const existing = elementGroups.get(parsed.element) || [];
        existing.push(id);
        elementGroups.set(parsed.element, existing);
      }
    }

    // Get natural abundances for each element and combine
    const allWeighted: WeightedNuclide[] = [];
    for (const [element, ids] of elementGroups) {
      const natural = getNaturalAbundances(db, element);

      // Scale by number of elements
      const elementWeight = 100 / elementGroups.size;

      // Find matching nuclides
      for (const id of ids) {
        const naturalMatch = natural.find((n) => n.nuclideId === id);
        if (naturalMatch) {
          allWeighted.push({
            ...naturalMatch,
            proportion: (naturalMatch.proportion * elementWeight) / 100,
          });
        }
      }
    }

    // Normalize the combined result
    const totalProportion = allWeighted.reduce((sum, n) => sum + n.proportion, 0);
    if (totalProportion > 0) {
      const normalized = allWeighted.map((n) => ({
        ...n,
        proportion: (n.proportion / totalProportion) * 100,
      }));
      onProportionsChange(normalized);
    }
  };

  // Normalize current values
  const handleNormalize = () => {
    const normalized = normalizeProportions(proportionInputs, 'manual');
    onProportionsChange(normalized);
  };

  if (nuclideIds.length === 0) {
    return (
      <div
        data-testid={testId}
        className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('proportions.selectFuelFirst')}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className="space-y-4"
    >
      {/* Header with label and format selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label ?? t('proportions.fuelProportions')}
          </span>
          <button
            type="button"
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            {showTooltip && (
              <div className="absolute left-0 top-6 z-50 w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                {getFormatHelpText(format)}
              </div>
            )}
          </button>
        </div>

        {showFormatSelector && (
          <select
            value={format}
            onChange={(e) => onFormatChange(e.target.value as ProportionFormat)}
            className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            data-testid={`${testId}-format-selector`}
          >
            <option value="percentage">{getFormatLabel('percentage')}</option>
            <option value="atomic-ratio">{getFormatLabel('atomic-ratio')}</option>
            <option value="mass-ratio">{getFormatLabel('mass-ratio')}</option>
          </select>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDistributeEqually}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          data-testid={`${testId}-distribute-equally`}
        >
          <Scale className="w-3.5 h-3.5" />
          {t('proportions.equal')}
        </button>
        <button
          type="button"
          onClick={handleResetToNatural}
          disabled={!db}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`${testId}-natural-abundance`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('proportions.natural')}
        </button>
        <button
          type="button"
          onClick={handleNormalize}
          disabled={total === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`${testId}-normalize`}
        >
          <Percent className="w-3.5 h-3.5" />
          {t('proportions.normalize')}
        </button>
      </div>

      {/* Proportion Inputs */}
      <div className="space-y-2">
        {nuclideIds.map((nuclideId) => {
          const value = inputValues.get(nuclideId) || '0';
          const numValue = parseFloat(value) || 0;
          const proportion = total > 0 ? (numValue / total) * 100 : 0;
          const error = validation.errors.find((e) => e.nuclideId === nuclideId);

          return (
            <div key={nuclideId} className="flex items-center gap-3">
              {/* Nuclide label */}
              <div className="w-16 font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                {nuclideId}
              </div>

              {/* Input field */}
              <div className="relative flex-1">
                <input
                  type="number"
                  value={value}
                  onChange={(e) => handleInputChange(nuclideId, e.target.value)}
                  onBlur={handleInputBlur}
                  min="0"
                  step={format === 'percentage' ? '0.1' : '1'}
                  className={`
                    w-full px-3 py-1.5 text-sm border rounded-lg
                    bg-white dark:bg-gray-800
                    text-gray-700 dark:text-gray-300
                    ${error
                      ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
                    }
                    focus:outline-none focus:ring-2 focus:ring-offset-0
                  `}
                  data-testid={`${testId}-input-${nuclideId}`}
                />
                {format === 'percentage' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    %
                  </span>
                )}
              </div>

              {/* Proportion bar */}
              <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 dark:bg-primary-400 transition-all duration-200"
                  style={{ width: `${Math.min(100, proportion)}%` }}
                />
              </div>

              {/* Normalized percentage */}
              <div className="w-20 text-right text-sm text-gray-500 dark:text-gray-400 font-mono">
                {formatProportion(proportion)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation Errors */}
      {!validation.isValid && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              {validation.errors.map((error, idx) => (
                <div key={idx}>{error.message}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Total display */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t('proportions.total')}:
        </span>
        <span
          className={`text-sm font-medium ${
            Math.abs(total - 100) < 0.01
              ? 'text-green-600 dark:text-green-400'
              : 'text-yellow-600 dark:text-yellow-400'
          }`}
        >
          {format === 'percentage' ? `${total.toFixed(2)}%` : total.toFixed(2)}
          {format === 'percentage' && Math.abs(total - 100) >= 0.01 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              {t('proportions.willBeNormalized')}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
