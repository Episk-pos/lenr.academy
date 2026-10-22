import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Beaker, Factory, FlaskConical, Atom, Save, Trash2, ChevronRight, ChevronLeft, User, Plus, Layers } from 'lucide-react';
import type { Material, MaterialCategory, WeightedNuclide } from '../types';
import {
  getAllMaterials,
  searchMaterials,
  materialToWeightedNuclides,
  saveCustomMaterial,
  deleteCustomMaterial,
  createMaterialFromWeightedNuclides,
  getCustomMaterials,
} from '../services/materialsService';
import { formatProportion, mergeWeightedNuclides } from '../services/proportionService';

interface MaterialsCatalogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMaterial: (weightedNuclides: WeightedNuclide[]) => void;
  currentFuel?: WeightedNuclide[];
}

type TabKey = 'all' | 'natural-abundance' | 'alloy' | 'compound' | 'lenr-experiment' | 'custom';

const TABS: { key: TabKey; labelKey: string; icon: typeof Atom }[] = [
  { key: 'all', labelKey: 'cascades.tabAll', icon: Beaker },
  { key: 'natural-abundance', labelKey: 'cascades.tabNatural', icon: Atom },
  { key: 'alloy', labelKey: 'cascades.tabAlloys', icon: Factory },
  { key: 'compound', labelKey: 'cascades.tabCompounds', icon: FlaskConical },
  { key: 'lenr-experiment', labelKey: 'cascades.tabLENR', icon: Beaker },
  { key: 'custom', labelKey: 'cascades.tabCustom', icon: User },
];

/**
 * Get translated material name
 * Falls back to raw name for custom materials or missing translations
 */
function getMaterialName(t: (key: string, options?: Record<string, unknown>) => string, material: Material): string {
  if (material.isCustom) return material.name;
  const key = `materials.${material.id}.name`;
  const translated = t(key, { defaultValue: '' });
  return translated || material.name;
}

/**
 * Get translated material description
 * Falls back to raw description for custom materials or missing translations
 */
function getMaterialDescription(t: (key: string, options?: Record<string, unknown>) => string, material: Material): string {
  if (material.isCustom) return material.description || '';
  const key = `materials.${material.id}.description`;
  const translated = t(key, { defaultValue: '' });
  return translated || material.description || '';
}

/**
 * Materials Catalog Modal
 *
 * Allows users to browse and select materials from the catalog,
 * or save their current fuel mixture as a custom material.
 */
export default function MaterialsCatalog({
  isOpen,
  onClose,
  onSelectMaterial,
  currentFuel,
}: MaterialsCatalogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  // Blend mode state
  const [blendMode, setBlendMode] = useState(false);
  const [blendMaterials, setBlendMaterials] = useState<Material[]>([]);

  // Refresh trigger to force re-render when materials change (e.g., after delete)
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter materials based on tab and search
  const filteredMaterials = useMemo(() => {
    let materials = searchQuery.trim()
      ? searchMaterials(searchQuery)
      : getAllMaterials();

    if (activeTab !== 'all') {
      materials = materials.filter((m) => m.category === activeTab);
    }

    return materials;
  }, [activeTab, searchQuery, refreshKey]);

  // Get icon for category
  const getCategoryIcon = (category: MaterialCategory) => {
    switch (category) {
      case 'natural-abundance':
        return <Atom className="w-4 h-4" />;
      case 'alloy':
        return <Factory className="w-4 h-4" />;
      case 'compound':
        return <FlaskConical className="w-4 h-4" />;
      case 'lenr-experiment':
        return <Beaker className="w-4 h-4" />;
      case 'custom':
        return <User className="w-4 h-4" />;
    }
  };

  // Get color for category
  const getCategoryColor = (category: MaterialCategory) => {
    switch (category) {
      case 'natural-abundance':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'alloy':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
      case 'compound':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'lenr-experiment':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'custom':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    }
  };

  // Handle material selection (single replace mode)
  const handleSelect = () => {
    if (!selectedMaterial) return;
    const weightedNuclides = materialToWeightedNuclides(selectedMaterial);
    onSelectMaterial(weightedNuclides);
    onClose();
  };

  // Add material to blend queue
  const handleAddToBlend = () => {
    if (!selectedMaterial) return;
    // Don't add duplicates
    if (blendMaterials.some((m) => m.id === selectedMaterial.id)) return;
    setBlendMaterials([...blendMaterials, selectedMaterial]);
    setSelectedMaterial(null);
  };

  // Remove material from blend queue
  const handleRemoveFromBlend = (materialId: string) => {
    setBlendMaterials(blendMaterials.filter((m) => m.id !== materialId));
  };

  // Clear all materials from blend queue
  const handleClearBlend = () => {
    setBlendMaterials([]);
    setSelectedMaterial(null);
  };

  // Apply blended materials
  const handleApplyBlend = () => {
    if (blendMaterials.length === 0) return;
    const allNuclides = blendMaterials.map((m) => materialToWeightedNuclides(m));
    const blended = mergeWeightedNuclides(...allNuclides);
    onSelectMaterial(blended);
    setBlendMaterials([]);
    onClose();
  };

  // Check if material is in blend queue
  const isInBlend = (materialId: string) => {
    return blendMaterials.some((m) => m.id === materialId);
  };

  // Handle save custom material
  const handleSaveCustom = () => {
    if (!currentFuel || currentFuel.length === 0 || !saveName.trim()) return;

    const materialData = createMaterialFromWeightedNuclides(
      currentFuel,
      saveName.trim(),
      saveDescription.trim() || `Custom fuel mixture saved on ${new Date().toLocaleDateString()}`
    );

    saveCustomMaterial(materialData);
    setShowSaveDialog(false);
    setSaveName('');
    setSaveDescription('');
    // Trigger re-render and switch to custom tab to show new material
    setRefreshKey((k) => k + 1);
    setActiveTab('custom');
  };

  // Handle delete custom material
  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('cascades.deleteCustomMaterial'))) {
      deleteCustomMaterial(id);
      if (selectedMaterial?.id === id) {
        setSelectedMaterial(null);
      }
      // Trigger re-render to update the materials list
      setRefreshKey((k) => k + 1);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        data-testid="materials-catalog-overlay"
        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
          data-testid="materials-catalog-modal"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="min-w-0 flex-1 pr-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {t('cascades.materialsCatalog')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">
                {t('cascades.materialsCatalogSubtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search and Actions */}
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('cascades.searchMaterials')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  data-testid="materials-search-input"
                />
              </div>
              {currentFuel && currentFuel.length > 0 && (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors whitespace-nowrap"
                  data-testid="save-custom-material-button"
                >
                  <Save className="w-4 h-4" />
                  {t('cascades.saveCurrent')}
                </button>
              )}
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('cascades.mode')}:</span>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => setBlendMode(false)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    !blendMode
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  data-testid="mode-replace"
                >
                  {t('cascades.replace')}
                </button>
                <button
                  onClick={() => setBlendMode(true)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    blendMode
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  data-testid="mode-blend"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {t('cascades.blend')}
                </button>
              </div>
              {blendMode && blendMaterials.length > 0 && (
                <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                  {blendMaterials.length} {t('common.selected')}
                </span>
              )}
            </div>

            {/* Blend Queue */}
            {blendMode && blendMaterials.length > 0 && (
              <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                    {t('cascades.materialsToBlend')}
                  </span>
                  <button
                    onClick={handleClearBlend}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    data-testid="clear-blend-button"
                  >
                    {t('cascades.clearAll')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {blendMaterials.map((material) => (
                    <span
                      key={material.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300 border border-primary-200 dark:border-primary-700"
                    >
                      {getMaterialName(t, material)}
                      <button
                        onClick={() => handleRemoveFromBlend(material.id)}
                        className="text-gray-400 hover:text-red-500 ml-1"
                        title={t('cascades.removeFromBlend')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs - always visible, hidden on mobile when viewing details */}
          <div className={`
            overflow-x-auto border-b border-gray-200 dark:border-gray-700 scrollbar-hide flex-shrink-0
            ${selectedMaterial ? 'hidden sm:block' : 'block'}
          `}>
            <div className="flex">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const count = tab.key === 'all'
                  ? getAllMaterials().length
                  : tab.key === 'custom'
                    ? getCustomMaterials().length
                    : getAllMaterials().filter((m) => m.category === tab.key).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`
                      flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                      ${activeTab === tab.key
                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                    data-testid={`materials-tab-${tab.key}`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(tab.labelKey)}
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Materials List - hidden on mobile when material is selected */}
            <div className={`
              w-full sm:w-1/2 sm:border-r border-gray-200 dark:border-gray-700 overflow-y-auto
              ${selectedMaterial ? 'hidden sm:block' : 'block'}
            `}>
              {filteredMaterials.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? t('cascades.noMaterialsFound', { query: searchQuery })
                    : t('cascades.noMaterialsInCategory')}
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMaterials.map((material) => {
                    const inBlend = isInBlend(material.id);
                    return (
                      <button
                        key={material.id}
                        onClick={() => setSelectedMaterial(material)}
                        className={`
                          w-full p-3 sm:p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                          ${selectedMaterial?.id === material.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                            : inBlend
                              ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500'
                              : ''
                          }
                        `}
                        data-testid={`material-item-${material.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded flex-shrink-0 ${getCategoryColor(material.category)}`}>
                                {getCategoryIcon(material.category)}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white truncate">
                                {getMaterialName(t, material)}
                              </span>
                              {inBlend && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded flex-shrink-0">
                                  {t('cascades.inBlend')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {getMaterialDescription(t, material)}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {material.tags?.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {material.isCustom && (
                              <button
                                onClick={(e) => handleDeleteCustom(material.id, e)}
                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title={t('cascades.deleteCustomMaterial')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Material Details - full width on mobile when selected */}
            <div className={`
              w-full sm:w-1/2 overflow-y-auto p-3 sm:p-4
              ${selectedMaterial ? 'block' : 'hidden sm:block'}
            `}>
              {selectedMaterial ? (
                <div>
                  {/* Back button - mobile only */}
                  <button
                    onClick={() => setSelectedMaterial(null)}
                    className="sm:hidden flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 mb-3 -ml-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('cascades.backToList')}
                  </button>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {getMaterialName(t, selectedMaterial)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {getMaterialDescription(t, selectedMaterial)}
                  </p>

                  {/* Source citation */}
                  {selectedMaterial.source && (
                    <div className="mb-4">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t('cascades.source')}:
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {selectedMaterial.source}
                      </p>
                    </div>
                  )}

                  {/* LENR experiment details */}
                  {'researcher' in selectedMaterial && (
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{t('cascades.researcher')}:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {(selectedMaterial as any).researcher}
                          </span>
                        </div>
                        {(selectedMaterial as any).year && (
                          <div className="flex justify-between mt-1">
                            <span className="text-gray-600 dark:text-gray-400">{t('cascades.year')}:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {(selectedMaterial as any).year}
                            </span>
                          </div>
                        )}
                        {(selectedMaterial as any).experimentType && (
                          <div className="flex justify-between mt-1">
                            <span className="text-gray-600 dark:text-gray-400">{t('cascades.type')}:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {(selectedMaterial as any).experimentType}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Composition table */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('cascades.composition')} ({selectedMaterial.composition.length} {t('cascades.nuclides')})
                    </h4>
                    <div className="overflow-y-auto overscroll-contain border border-gray-200 dark:border-gray-700 rounded-lg sm:max-h-80">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-400">
                              {t('cascades.nuclide')}
                            </th>
                            <th className="text-right px-3 py-2 text-gray-600 dark:text-gray-400">
                              {t('cascades.proportion')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {selectedMaterial.composition.map((comp) => (
                            <tr key={comp.nuclideId}>
                              <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">
                                {comp.nuclideId}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                {formatProportion(comp.proportion)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <Beaker className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('cascades.selectMaterialToView')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              {filteredMaterials.length} {t('cascades.materials').toLowerCase()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('cascades.cancel')}
              </button>
              {blendMode ? (
                <>
                  <button
                    onClick={handleAddToBlend}
                    disabled={!selectedMaterial || isInBlend(selectedMaterial?.id || '')}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                    data-testid="add-to-blend-button"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden xs:inline">{t('cascades.add')}</span>
                  </button>
                  <button
                    onClick={handleApplyBlend}
                    disabled={blendMaterials.length === 0}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                    data-testid="apply-blend-button"
                  >
                    <Layers className="w-4 h-4" />
                    <span className="hidden xs:inline">{t('cascades.blend')}</span> ({blendMaterials.length})
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSelect}
                  disabled={!selectedMaterial}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  data-testid="load-material-button"
                >
                  {t('cascades.load')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Custom Material Dialog */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4"
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('cascades.saveCustomMaterial')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('cascades.name')} *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t('cascades.customMaterialNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  data-testid="save-material-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('cascades.description')}
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder={t('cascades.optionalDescription')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('cascades.saveCurrentFuelMixture', { count: currentFuel?.length || 0 })}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('cascades.cancel')}
              </button>
              <button
                onClick={handleSaveCustom}
                disabled={!saveName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                data-testid="confirm-save-material-button"
              >
                {t('cascades.saveMaterial')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
