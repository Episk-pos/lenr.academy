import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { Element } from '../types';
import type { NuclideWithAbundance } from '../services/isotopeService';
import {
  getNuclidesForElement,
  filterAbundantNuclides,
  filterStableNuclides,
  getMostAbundantNuclide,
  formatAbundance,
  getAbundanceTierColor,
  getAbundanceTierHoverColor,
} from '../services/isotopeService';
import { useDatabase } from '../contexts/DatabaseContext';

interface NuclidePickerModalProps {
  element: Element;
  isOpen: boolean;
  onClose: () => void;
  selectedNuclides: string[]; // Array of nuclide notations (e.g., ["Li-7", "Ni-58"])
  onSelectionChange: (nuclides: string[]) => void;
}

export default function NuclidePickerModal({
  element,
  isOpen,
  onClose,
  selectedNuclides,
  onSelectionChange,
}: NuclidePickerModalProps) {
  const { db } = useDatabase();
  const [nuclides, setNuclides] = useState<NuclideWithAbundance[]>([]);
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set());

  // Load nuclides when modal opens or element changes
  useEffect(() => {
    if (!db || !isOpen) return;

    // Special handling for hydrogen: also load D and T isotopes
    let loadedNuclides: NuclideWithAbundance[] = [];
    if (element.E === 'H') {
      // Load all hydrogen isotopes (H, D, T) since they're stored separately in the database
      const hNuclides = getNuclidesForElement(db, 'H');
      const dNuclides = getNuclidesForElement(db, 'D');
      const tNuclides = getNuclidesForElement(db, 'T');
      loadedNuclides = [...hNuclides, ...dNuclides, ...tNuclides];
      // Sort by mass number for consistent display
      loadedNuclides.sort((a, b) => a.A - b.A);
    } else {
      loadedNuclides = getNuclidesForElement(db, element.E);
    }

    setNuclides(loadedNuclides);

    // Initialize local selection from props
    const elementNuclides = selectedNuclides.filter((n) =>
      loadedNuclides.some((nuclide) => nuclide.notation === n)
    );
    setLocalSelection(new Set(elementNuclides));
  }, [db, element.E, isOpen, selectedNuclides]);

  const toggleNuclide = (notation: string) => {
    const newSelection = new Set(localSelection);
    if (newSelection.has(notation)) {
      newSelection.delete(notation);
    } else {
      newSelection.add(notation);
    }
    setLocalSelection(newSelection);
  };

  const handleQuickSelect = (type: 'most-common' | 'abundant' | 'stable' | 'all' | 'none') => {
    let selected: string[] = [];

    switch (type) {
      case 'most-common': {
        const mostAbundant = getMostAbundantNuclide(nuclides);
        if (mostAbundant) selected = [mostAbundant.notation];
        break;
      }
      case 'abundant': {
        const abundant = filterAbundantNuclides(nuclides, 1.0);
        selected = abundant.map((n) => n.notation);
        break;
      }
      case 'stable': {
        const stable = filterStableNuclides(nuclides);
        selected = stable.map((n) => n.notation);
        break;
      }
      case 'all': {
        selected = nuclides.map((n) => n.notation);
        break;
      }
      case 'none': {
        selected = [];
        break;
      }
    }

    setLocalSelection(new Set(selected));
  };

  const handleSave = () => {
    // Merge local selection with other selected nuclides (from other elements)
    const otherElementNuclides = selectedNuclides.filter((n) =>
      !nuclides.some((nuclide) => nuclide.notation === n)
    );

    const newSelection = [...otherElementNuclides, ...Array.from(localSelection)];
    onSelectionChange(newSelection);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        data-testid="modal-overlay"
        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
        onClick={handleCancel}
      >
        {/* Modal Content */}
        <div
          data-testid="modal-content"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {element.EName} Isotopes
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select isotopes for {element.E} (Z={element.Z})
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Select Buttons */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Select:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickSelect('most-common')}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Most Common
              </button>
              <button
                onClick={() => handleQuickSelect('abundant')}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Abundant (&gt;1%)
              </button>
              <button
                onClick={() => handleQuickSelect('stable')}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Stable
              </button>
              <button
                onClick={() => handleQuickSelect('all')}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                All
              </button>
              <button
                onClick={() => handleQuickSelect('none')}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-red-600 dark:text-red-400"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Isotope Grid */}
          <div className="p-4 overflow-y-auto flex-1">
            {nuclides.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No isotopes found for {element.E}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {nuclides.map((nuclide) => {
                  const isSelected = localSelection.has(nuclide.notation);
                  const baseColor = getAbundanceTierColor(nuclide.abundanceTier);
                  const hoverColor = getAbundanceTierHoverColor(nuclide.abundanceTier);

                  return (
                    <button
                      key={nuclide.notation}
                      onClick={() => toggleNuclide(nuclide.notation)}
                      className={`
                        relative p-3 rounded-lg border-2 transition-all
                        ${baseColor}
                        ${hoverColor}
                        ${isSelected
                          ? 'ring-2 ring-primary-500 dark:ring-primary-400 shadow-lg'
                          : 'shadow'
                        }
                      `}
                    >
                      {/* Selected Checkmark */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary-600 dark:bg-primary-500 rounded-full p-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Isotope Notation */}
                      <div className="font-mono font-bold text-lg mb-1">
                        {element.E}-{nuclide.A}
                      </div>

                      {/* Abundance */}
                      <div className="text-xs font-medium">
                        {formatAbundance(nuclide.abundance)}
                      </div>

                      {/* Stability Indicator */}
                      {!nuclide.isStable && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Unstable
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color Legend:
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-green-500 dark:bg-green-600"></span>
                <span className="text-gray-700 dark:text-gray-300">Abundant (&gt;10%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-yellow-500 dark:bg-yellow-600"></span>
                <span className="text-gray-700 dark:text-gray-300">Trace (0.1-10%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-gray-400 dark:bg-gray-600"></span>
                <span className="text-gray-700 dark:text-gray-300">Rare/Synthetic</span>
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {localSelection.size} selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
