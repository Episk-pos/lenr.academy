# Phase 2: Materials Catalog - Implementation Plan

## 🎯 Overview

Based on [Issue #96](https://github.com/Episk-pos/lenr.academy/issues/96), Phase 2 adds a curated, browseable catalog of common fuel materials with predefined isotopic compositions.

**Goal:** Enable users to quickly select real-world materials (natural lithium, deuterium-enriched fuel, etc.) instead of manually entering proportions.

---

## 📋 Requirements from Issue #96

### Core Features
1. **Predefined Material Library**
   - Natural isotope abundances (Li, H, D, etc.)
   - Common enriched materials
   - Historical experiment compositions (Parkhomov, Rossi, etc.)

2. **User Interface**
   - Browse/search materials catalog
   - One-click material selection
   - Preview composition before applying
   - Option to customize after selection

3. **Data Management**
   - Extensible catalog format (JSON)
   - Easy to add new materials
   - Metadata (source, references, notes)

---

## 🏗️ Architecture Design

### 1. Data Model

#### Material Definition
```typescript
// src/types/materials.ts
export interface FuelMaterial {
  id: string;                       // Unique identifier (e.g., "natural-lithium")
  name: string;                     // Display name
  category: MaterialCategory;       // Classification
  composition: FuelNuclide[];       // Isotopic breakdown
  metadata: MaterialMetadata;       // Additional information
}

export type MaterialCategory = 
  | 'natural'        // Natural isotope abundances
  | 'enriched'       // Enriched materials
  | 'experimental'   // Historical LENR experiments
  | 'custom';        // User-defined (future)

export interface MaterialMetadata {
  source: string;                   // Data source/reference
  description?: string;             // Material description
  references?: string[];            // Citations/links
  notes?: string;                   // Additional notes
  created?: string;                 // ISO date
  updated?: string;                 // ISO date
}
```

---

### 2. Data Storage

#### JSON Catalog
```json
// public/data/fuel-materials.json
{
  "version": "1.0.0",
  "materials": [
    {
      "id": "natural-lithium",
      "name": "Natural Lithium",
      "category": "natural",
      "composition": [
        {
          "nuclideId": "Li-7",
          "proportion": 0.9241,
          "displayValue": 92.41,
          "format": "percentage"
        },
        {
          "nuclideId": "Li-6",
          "proportion": 0.0759,
          "displayValue": 7.59,
          "format": "percentage"
        }
      ],
      "metadata": {
        "source": "IAEA NDS",
        "description": "Naturally occurring lithium isotope abundance",
        "references": [
          "https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html"
        ]
      }
    },
    {
      "id": "natural-hydrogen",
      "name": "Natural Hydrogen",
      "category": "natural",
      "composition": [
        {
          "nuclideId": "H-1",
          "proportion": 0.999885,
          "displayValue": 99.9885,
          "format": "percentage"
        },
        {
          "nuclideId": "D-2",
          "proportion": 0.000115,
          "displayValue": 0.0115,
          "format": "percentage"
        }
      ],
      "metadata": {
        "source": "IAEA NDS",
        "description": "Natural hydrogen isotope abundance"
      }
    },
    {
      "id": "deuterium-enriched",
      "name": "Deuterium (99% enriched)",
      "category": "enriched",
      "composition": [
        {
          "nuclideId": "D-2",
          "proportion": 0.99,
          "displayValue": 99,
          "format": "percentage"
        },
        {
          "nuclideId": "H-1",
          "proportion": 0.01,
          "displayValue": 1,
          "format": "percentage"
        }
      ],
      "metadata": {
        "source": "Typical commercial D2 gas",
        "description": "Heavy water / deuterium gas (commercial grade)"
      }
    },
    {
      "id": "parkhomov-2015",
      "name": "Parkhomov Replication (2015)",
      "category": "experimental",
      "composition": [
        {
          "nuclideId": "Li-7",
          "proportion": 0.85,
          "displayValue": 85,
          "format": "percentage"
        },
        {
          "nuclideId": "Ni-58",
          "proportion": 0.10,
          "displayValue": 10,
          "format": "percentage"
        },
        {
          "nuclideId": "H-1",
          "proportion": 0.05,
          "displayValue": 5,
          "format": "percentage"
        }
      ],
      "metadata": {
        "source": "Parkhomov 2015 replication",
        "description": "LiAlH4 + Ni powder fuel composition",
        "references": [
          "https://doi.org/10.13140/RG.2.1.4773.5363"
        ],
        "notes": "Approximate composition based on reported ratios"
      }
    }
  ]
}
```

---

### 3. Service Layer

#### Materials Service
```typescript
// src/services/materialsService.ts
import type { FuelMaterial, MaterialCategory } from '../types/materials';

/**
 * Load materials catalog from JSON
 */
export async function loadMaterialsCatalog(): Promise<FuelMaterial[]> {
  const response = await fetch('/data/fuel-materials.json');
  const data = await response.json();
  return data.materials;
}

/**
 * Get material by ID
 */
export function getMaterialById(
  materials: FuelMaterial[],
  id: string
): FuelMaterial | undefined {
  return materials.find((m) => m.id === id);
}

/**
 * Filter materials by category
 */
export function filterByCategory(
  materials: FuelMaterial[],
  category: MaterialCategory
): FuelMaterial[] {
  return materials.filter((m) => m.category === category);
}

/**
 * Search materials by name/description
 */
export function searchMaterials(
  materials: FuelMaterial[],
  query: string
): FuelMaterial[] {
  const lowerQuery = query.toLowerCase();
  return materials.filter((m) =>
    m.name.toLowerCase().includes(lowerQuery) ||
    m.metadata.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Validate material composition
 */
export function validateMaterial(material: FuelMaterial): boolean {
  // Proportions sum to 1.0
  const sum = material.composition.reduce((acc, fn) => acc + fn.proportion, 0);
  return Math.abs(sum - 1.0) < 0.001;
}
```

---

### 4. UI Components

#### Materials Browser Modal
```tsx
// src/components/MaterialsBrowser.tsx
interface MaterialsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMaterial: (material: FuelMaterial) => void;
}

export function MaterialsBrowser({
  isOpen,
  onClose,
  onSelectMaterial,
}: MaterialsBrowserProps) {
  const [materials, setMaterials] = useState<FuelMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [previewMaterial, setPreviewMaterial] = useState<FuelMaterial | null>(null);

  // Load materials on mount
  useEffect(() => {
    loadMaterialsCatalog().then(setMaterials);
  }, []);

  // Filter materials
  const filteredMaterials = useMemo(() => {
    let result = materials;

    // Category filter
    if (selectedCategory !== 'all') {
      result = filterByCategory(result, selectedCategory);
    }

    // Search filter
    if (searchQuery) {
      result = searchMaterials(result, searchQuery);
    }

    return result;
  }, [materials, selectedCategory, searchQuery]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader>
        <h2>Fuel Materials Catalog</h2>
      </ModalHeader>
      
      <ModalBody>
        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        {/* Category Filter */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={categoryButtonClass(selectedCategory === 'all')}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('natural')}
            className={categoryButtonClass(selectedCategory === 'natural')}
          >
            Natural
          </button>
          <button
            onClick={() => setSelectedCategory('enriched')}
            className={categoryButtonClass(selectedCategory === 'enriched')}
          >
            Enriched
          </button>
          <button
            onClick={() => setSelectedCategory('experimental')}
            className={categoryButtonClass(selectedCategory === 'experimental')}
          >
            Experimental
          </button>
        </div>

        {/* Materials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onPreview={() => setPreviewMaterial(material)}
              onSelect={() => {
                onSelectMaterial(material);
                onClose();
              }}
            />
          ))}
        </div>

        {/* Preview Panel */}
        {previewMaterial && (
          <MaterialPreview
            material={previewMaterial}
            onClose={() => setPreviewMaterial(null)}
          />
        )}
      </ModalBody>

      <ModalFooter>
        <button onClick={onClose}>Cancel</button>
      </ModalFooter>
    </Modal>
  );
}
```

#### Material Card Component
```tsx
// src/components/MaterialCard.tsx
interface MaterialCardProps {
  material: FuelMaterial;
  onPreview: () => void;
  onSelect: () => void;
}

export function MaterialCard({ material, onPreview, onSelect }: MaterialCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold">{material.name}</h3>
          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
            {material.category}
          </span>
        </div>
        <button onClick={onPreview} className="text-gray-500 hover:text-gray-700">
          <InfoIcon size={20} />
        </button>
      </div>

      {/* Composition Summary */}
      <div className="mb-3">
        <p className="text-sm text-gray-600 mb-1">Composition:</p>
        <div className="space-y-1">
          {material.composition.map((fn) => (
            <div key={fn.nuclideId} className="flex items-center gap-2">
              <span className="text-sm font-mono">{fn.nuclideId}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 rounded-full h-2"
                  style={{ width: `${fn.proportion * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">
                {(fn.proportion * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onSelect}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Use This Material
      </button>
    </div>
  );
}
```

---

### 5. Integration with Cascades Page

#### Updated CascadesAll.tsx
```tsx
// Add to src/pages/CascadesAll.tsx

// State for materials browser
const [showMaterialsBrowser, setShowMaterialsBrowser] = useState(false);

// Handler for material selection
const handleSelectMaterial = (material: FuelMaterial) => {
  // Apply material composition
  setFuelProportions(material.composition);
  setUseWeightedMode(true); // Auto-enable weighted mode
  
  // Optional: Show notification
  toast.success(`Applied material: ${material.name}`);
};

// UI Addition: Button to open materials browser
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">
    Fuel Material
  </label>
  <div className="flex gap-2">
    <button
      onClick={() => setShowMaterialsBrowser(true)}
      className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
    >
      <BookIcon size={16} />
      Browse Materials Catalog
    </button>
    {fuelProportions && fuelProportions.length > 0 && (
      <button
        onClick={() => {
          setFuelProportions([]);
          setUseWeightedMode(false);
        }}
        className="px-4 py-2 text-gray-600 hover:text-gray-800"
      >
        Clear
      </button>
    )}
  </div>
</div>

{/* Materials Browser Modal */}
<MaterialsBrowser
  isOpen={showMaterialsBrowser}
  onClose={() => setShowMaterialsBrowser(false)}
  onSelectMaterial={handleSelectMaterial}
/>
```

---

## 📊 Catalog Contents (Initial)

### Natural Materials
- ✅ Natural Lithium (92.41% Li-7, 7.59% Li-6)
- ✅ Natural Hydrogen (99.99% H-1, 0.01% D-2)
- ✅ Natural Boron (80% B-11, 20% B-10)
- ✅ Natural Nickel (68% Ni-58, 26% Ni-60, etc.)

### Enriched Materials
- ✅ Deuterium (99% D-2)
- ✅ Lithium-6 Enriched (95% Li-6)
- ✅ Lithium-7 Enriched (99% Li-7)
- ✅ Tritium (radioactive)

### Historical Experiments
- ✅ Parkhomov 2015 (LiAlH4 + Ni)
- ✅ Rossi E-Cat (estimated composition)
- ✅ Pons-Fleischmann (Pd + D2O)

### Total: ~15-20 predefined materials

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// src/services/materialsService.test.ts
describe('materialsService', () => {
  it('should load materials catalog')
  it('should get material by ID')
  it('should filter by category')
  it('should search by name')
  it('should validate compositions')
});
```

### Integration Tests
```typescript
// src/components/MaterialsBrowser.test.tsx
describe('MaterialsBrowser', () => {
  it('should display all materials')
  it('should filter by category')
  it('should search materials')
  it('should preview material details')
  it('should select material and apply to cascade')
});
```

---

## 📋 Implementation Checklist

### Phase 2.1: Data Layer (Week 1)
- [ ] Define `FuelMaterial` types in `src/types/materials.ts`
- [ ] Create `public/data/fuel-materials.json` catalog
- [ ] Populate catalog with 15-20 materials
- [ ] Implement `materialsService.ts`
- [ ] Write unit tests for service

### Phase 2.2: UI Components (Week 2)
- [ ] Create `MaterialsBrowser` modal component
- [ ] Create `MaterialCard` component
- [ ] Create `MaterialPreview` component
- [ ] Add search and filter functionality
- [ ] Style with Tailwind CSS

### Phase 2.3: Integration (Week 3)
- [ ] Add "Browse Materials Catalog" button to `CascadesAll.tsx`
- [ ] Implement material selection handler
- [ ] Auto-enable weighted mode on material selection
- [ ] Add clear/reset functionality
- [ ] Update state persistence to save selected material

### Phase 2.4: Polish & Testing (Week 4)
- [ ] Write component tests
- [ ] Add loading states and error handling
- [ ] Implement material preview tooltips
- [ ] Add keyboard shortcuts (e.g., `/` to search)
- [ ] Documentation and user guide

---

## 🎨 UI/UX Design

### Materials Browser Flow
```
User clicks "Browse Materials Catalog"
  ↓
Modal opens with materials grid
  ↓
User can:
- Search by name
- Filter by category
- Preview composition
- Read metadata/references
  ↓
User clicks "Use This Material"
  ↓
Modal closes, composition applied
Weighted mode auto-enabled
```

### Visual Design
- **Card-based grid layout** (2 columns on desktop)
- **Progress bars** for isotope proportions
- **Category badges** for visual classification
- **Hover effects** for interactivity
- **Preview panel** for detailed information

---

## 🔄 Future Enhancements (Phase 3+)

### User-Defined Materials
- Allow users to save custom materials
- LocalStorage persistence
- Export/import materials

### Advanced Features
- Material mixing (blend two materials)
- Temperature/pressure corrections
- Historical experiment database
- Community-contributed materials

---

## 📈 Success Metrics

### Functionality
- ✅ Materials load from JSON successfully
- ✅ Search and filter work correctly
- ✅ Material selection applies to cascade
- ✅ Composition validation passes

### User Experience
- ✅ Modal opens/closes smoothly
- ✅ Search responds instantly
- ✅ Material cards are intuitive
- ✅ Preview provides useful information

### Performance
- ✅ Catalog loads in <500ms
- ✅ Search/filter operations instant
- ✅ Modal animations smooth (60fps)

---

## 🚀 Deployment Strategy

### Database Preparation
1. Research and compile accurate isotope abundances
2. Verify historical experiment compositions
3. Add proper citations and references
4. Validate JSON format

### Incremental Rollout
1. **Week 1:** Backend services + tests
2. **Week 2:** UI components (hidden feature flag)
3. **Week 3:** Integration with cascades page
4. **Week 4:** Public release with documentation

---

## 📚 Documentation Needed

### User Documentation
- **How to use the materials catalog**
- **Material descriptions and sources**
- **Customizing compositions after selection**

### Developer Documentation
- **Adding new materials to catalog**
- **Material validation rules**
- **Extending the materials system**

---

## 🎯 Alignment with Issue #96

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Predefined materials library | ✅ Planned | JSON catalog |
| Browse/search interface | ✅ Planned | MaterialsBrowser modal |
| One-click selection | ✅ Planned | MaterialCard component |
| Natural abundances | ✅ Planned | Included in catalog |
| Historical experiments | ✅ Planned | Parkhomov, Rossi, etc. |
| Metadata/references | ✅ Planned | MaterialMetadata type |
| Extensible format | ✅ Planned | JSON schema |

**Alignment: 100%** ✅

---

## ⏱️ Time Estimate

### Development
- **Data Layer:** 8 hours
- **UI Components:** 16 hours
- **Integration:** 8 hours
- **Testing:** 12 hours
- **Polish & Docs:** 8 hours

**Total:** ~52 hours (1.5 weeks full-time)

### Research
- **Isotope abundances:** 4 hours
- **Historical experiments:** 4 hours
- **Citations/references:** 4 hours

**Total Research:** ~12 hours

**Grand Total:** ~64 hours (2 weeks)

---

## 🎉 Summary

Phase 2 will significantly enhance the user experience by:
- ✅ **Reducing friction** - No manual proportion entry
- ✅ **Improving accuracy** - Curated, validated data
- ✅ **Educational value** - Learn about real materials
- ✅ **Research utility** - Model actual experiments

**Complexity:** Medium  
**Impact:** High  
**Timeline:** 2 weeks  
**Readiness:** Ready to start after Phase 1 completion

---

**Status:** 📋 **Planning Complete**  
**Next Step:** Begin Phase 2.1 - Data Layer Implementation  
**Prerequisites:** Phase 1 must be 100% complete (currently 90%)

---

**Documented by:** AI Assistant  
**Date:** October 26, 2025  
**Issue:** [#96 - Weighted Fuel Proportions and Materials Catalog](https://github.com/Episk-pos/lenr.academy/issues/96)

