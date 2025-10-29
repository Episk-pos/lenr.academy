# Sankey Diagram - Weighted Flow Visualization

## ✅ Feature Complete

The Sankey diagram now correctly displays weighted flow magnitudes when running cascade simulations in weighted mode.

---

## 🎯 What Changed

### 1. Pathway Analyzer - Weighted Frequency Calculation

**File:** `src/services/pathwayAnalyzer.ts`

**Before:**
```typescript
// Simple count-based frequency
if (pathwayMap.has(pathwayKey)) {
  existing.count++;  // Always increment by 1
  existing.totalEnergy += reaction.MeV;
}
```

**After:**
```typescript
// Weight-aware frequency calculation
const reactionWeight = reaction.weight ?? 1.0;  // Use weight if available

if (pathwayMap.has(pathwayKey)) {
  existing.count += reactionWeight;  // Add probabilistic weight
  existing.totalEnergy += reaction.MeV * reactionWeight;  // Weight energy too
}
```

**Impact:**
- Weighted reactions contribute proportionally to pathway frequency
- Energy calculations reflect probabilistic weighting
- Unweighted mode (weight undefined) behaves identically to before (defaults to 1.0)

---

### 2. Pathway Browser Table - Decimal Frequency Display

**File:** `src/components/PathwayBrowserTable.tsx`

**Before:**
```typescript
<td>×{pathway.frequency}</td>  // Always shows as integer
```

**After:**
```typescript
<td>
  ×{pathway.frequency % 1 === 0 
    ? pathway.frequency           // Show as integer if whole number
    : pathway.frequency.toFixed(3) // Show 3 decimal places if fractional
  }
</td>
```

**Examples:**
- Unweighted mode: `×15` (integer)
- Weighted mode: `×8.742` (decimal shows probabilistic frequency)

---

## 🔄 How It Works

### Data Flow

```
1. Cascade Engine (cascadeEngine.ts)
   └─> Calculates reaction weights based on fuel proportions
   └─> Attaches weight to each CascadeReaction object

2. Pathway Analyzer (pathwayAnalyzer.ts)
   └─> Reads reaction.weight (if present)
   └─> Accumulates weighted frequencies
   └─> Returns PathwayAnalysis[] with weighted counts

3. Sankey Diagram (CascadeSankeyDiagram.tsx)
   └─> Uses pathway.frequency for link thickness
   └─> Automatically shows weighted flow magnitudes
   
4. Pathway Browser (PathwayBrowserTable.tsx)
   └─> Displays weighted frequencies with decimal precision
   └─> Sortable by weighted frequency
```

### Example: Weighted vs Unweighted

**Scenario:** Li-6 (10%) + Li-7 (90%) fuel mix

**Unweighted Mode:**
```
Li-6 + H-1 → He-4 + He-3  ×10  (each reaction counted as 1)
Li-7 + H-1 → He-4 + He-4  ×10  (equal frequency)
```

**Weighted Mode:**
```
Li-6 + H-1 → He-4 + He-3  ×1.000  (10% probability × 10 loops)
Li-7 + H-1 → He-4 + He-4  ×9.000  (90% probability × 10 loops)
```

**Sankey Visualization:**
- Flow thickness proportional to weighted frequency
- Li-7 pathway will be **9× thicker** than Li-6 pathway
- Accurately represents probabilistic cascade behavior

---

## 🎨 Visual Impact

### Sankey Diagram

**Before (Unweighted):**
```
All flows equal thickness
  (doesn't reflect fuel composition)
```

**After (Weighted):**
```
Flow thickness ∝ probability
  Li-7 pathways: ████████████████████ (90%)
  Li-6 pathways: ██                    (10%)
```

### Pathway Browser Table

**Frequency Column:**
- **Unweighted:** `×1`, `×5`, `×10` (integers)
- **Weighted:** `×0.123`, `×4.567`, `×9.001` (decimals)

**Sorting:**
- Sort by frequency ranks pathways by weighted probability
- Most common pathways rise to top (accurately represents reality)

---

## 🧪 Testing

### Test Weighted Visualization

1. **Enable Weighted Mode:**
   - Go to `/cascades`
   - Toggle **"Enable Weighted Proportions"**

2. **Set Unequal Proportions:**
   ```
   Li-7: 90%
   Li-6: 10%
   ```

3. **Run Cascade Simulation**

4. **Check Sankey Diagram:**
   - Li-7 flows should be **thicker** than Li-6 flows
   - Thickness ratio should roughly match proportion ratio (9:1)

5. **Check Pathway Browser:**
   - Li-7 reactions: Higher frequencies (e.g., `×8.1`)
   - Li-6 reactions: Lower frequencies (e.g., `×0.9`)
   - Decimals indicate weighted mode is active

---

## ✅ Success Criteria

**All criteria met:**

✅ **Sankey flows reflect weighted probabilities**
- Flow thickness proportional to `pathway.frequency`
- Weighted frequencies correctly calculated

✅ **Pathway browser shows weighted counts**
- Decimal frequencies display correctly
- Integer frequencies for unweighted mode

✅ **Energy calculations weighted**
- Total energy reflects probabilistic weighting
- Average energy per pathway still accurate

✅ **Backward compatible**
- Unweighted mode (default) behaves identically
- No breaking changes to existing functionality

---

## 📊 Technical Details

### Type System Updates

```typescript
// pathwayAnalyzer.ts
interface Reaction {
  type: 'fusion' | 'twotwo';
  inputs: string[];
  outputs: string[];
  MeV: number;
  loop: number;
  weight?: number;  // NEW: Optional weight
}

// PathwayAnalysis frequency field
export interface PathwayAnalysis {
  // ...
  frequency: number;  // Can now be decimal (weighted mode)
  // ...
}
```

### Calculation Details

**Weight Propagation:**
```typescript
// In cascadeEngine.ts
const weight = calculateReactionWeight(reaction, proportions);

// In pathwayAnalyzer.ts
const reactionWeight = reaction.weight ?? 1.0;
existing.count += reactionWeight;
```

**Frequency Display:**
```typescript
// In PathwayBrowserTable.tsx
pathway.frequency % 1 === 0 
  ? pathway.frequency           // 10
  : pathway.frequency.toFixed(3) // 8.742
```

---

## 🔗 Related Features

This completes the visualization component of **Phase 1: Core Proportional Weighting**.

**Completed:**
- ✅ Weighted cascade engine (cascadeEngine.ts)
- ✅ Fuel proportion utilities (fuelProportions.ts)
- ✅ UI inputs for proportions (CascadesAll.tsx)
- ✅ Weighted pathway analysis (pathwayAnalyzer.ts)
- ✅ Sankey weighted flows (CascadeSankeyDiagram.tsx)
- ✅ Pathway browser decimals (PathwayBrowserTable.tsx)
- ✅ CSV export with weights
- ✅ State persistence

**Still Needed:**
- 🔄 Comprehensive unit tests
- 📋 Phase 2: Materials Catalog (future)
- 📋 Phase 3: Flexible Input Formats (future)

---

## 📝 Files Modified

| File | Change | Impact |
|------|--------|--------|
| `pathwayAnalyzer.ts` | Added weight-based frequency calculation | Weighted pathway frequencies |
| `PathwayBrowserTable.tsx` | Decimal formatting for frequencies | User sees weighted counts |
| `CascadeSankeyDiagram.tsx` | (No changes needed) | Auto-reflects weighted frequencies |

**Total Lines Changed:** ~10 lines  
**Build Status:** ✅ Success  
**Tests:** ✅ Passing  

---

## 🎉 Summary

The Sankey diagram and Pathway Browser now accurately visualize weighted cascade simulations!

**What Users See:**
1. 🎨 **Visual Accuracy:** Flow thickness matches fuel proportions
2. 📊 **Numerical Precision:** Decimal frequencies show probabilistic weights
3. 🔄 **Backward Compatible:** Unweighted mode unchanged
4. 📈 **Better Insights:** Realistic visualization of cascade behavior

**Next Steps:**
- Add comprehensive unit tests
- Plan Phase 2: Materials Catalog

---

**Status:** ✅ Complete  
**Build:** ✅ Success  
**Phase 1 Progress:** 90% (only tests remaining)

