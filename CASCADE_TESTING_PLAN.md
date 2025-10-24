# Cascade Feature Testing Coverage Plan

**Branch:** `feat/cascade`
**Created:** 2025-10-24
**Purpose:** Comprehensive testing strategy for cascade simulation feature (Issues #15, #16, #17)

---

## Table of Contents

1. [Current Test Coverage](#current-test-coverage)
2. [Missing Unit Tests](#missing-unit-tests)
3. [Missing Component Tests](#missing-component-tests)
4. [E2E Test Additions](#e2e-test-additions)
5. [Implementation Checklist](#implementation-checklist)
6. [Testing Commands](#testing-commands)

---

## Current Test Coverage

### Existing Unit Tests (Vitest)

#### ✅ `src/services/cascadeEngine.test.ts` (604 lines, ~20 tests)
**Coverage:**
- ✅ Fuel nuclide parsing (H-1, H1, D, T formats)
- ✅ Cascade execution with different termination modes
- ✅ Max loops termination
- ✅ No new products termination
- ✅ Max nuclides termination
- ✅ Reaction tracking and results structure
- ✅ Error handling for invalid inputs
- ✅ Performance metrics (timing, counts)

#### ✅ `src/services/cascadeFeedbackRules.test.ts` (410 lines, ~31 tests)
**Coverage:**
- ✅ Temperature threshold filtering
- ✅ Boson/Fermion classification
- ✅ Element allowlist constraints
- ✅ Database-driven parameter limits
- ✅ Rule combination logic
- ✅ Edge cases (missing data, invalid ranges)

### Existing E2E Tests (Playwright)

#### ✅ `e2e/cascade-simulation.spec.ts` (251 lines, ~12 tests)
**Coverage:**
- ✅ Page load with default parameters
- ✅ Run cascade simulation end-to-end
- ✅ Progress updates during simulation
- ✅ Cancel operation
- ✅ Fuel nuclides validation
- ✅ Feedback rule settings
- ✅ Database table name regression check
- ✅ Reaction types display
- ✅ Product distribution display
- ✅ Parameter adjustments
- ✅ Empty state handling

### Test Statistics

| Type | Files | Tests | Lines |
|------|-------|-------|-------|
| Unit | 2 | ~51 | 1,014 |
| E2E | 1 | ~12 | 251 |
| **Total** | **3** | **~63** | **1,265** |

---

## Missing Unit Tests

### 1. `src/services/isotopeService.test.ts` ❌ NEW

**Purpose:** Test nuclide selection and natural abundance data

**Test Cases:**

#### Nuclide Querying
- [ ] `getNuclidesForElement()` returns correct isotopes
- [ ] Handles non-existent elements gracefully
- [ ] Sorts nuclides by mass number (A)
- [ ] Includes all database columns correctly

#### Abundance Filtering
- [ ] `filterAbundantNuclides()` uses correct thresholds
  - Abundant: ≥1%
  - Trace: 0.01% - 1%
  - Rare: <0.01%
  - Synthetic: no abundance data
- [ ] `filterStableNuclides()` correctly identifies stable isotopes (LHL > 9)
- [ ] `getMostAbundantNuclide()` returns highest percentage

#### Formatting & Display
- [ ] `formatAbundance()` formats percentages correctly
  - >10%: "15.3%"
  - 1-10%: "5.42%"
  - <1%: "0.012%"
  - Trace: "<0.001%"
- [ ] `getAbundanceTierColor()` returns correct Tailwind classes
- [ ] `getAbundanceTierHoverColor()` returns correct hover states

#### Edge Cases
- [ ] Hydrogen isotopes (H, D, T) handled specially
- [ ] Elements with no isotopes
- [ ] Nuclides with missing abundance data
- [ ] Very large/small abundance values

**Estimated Effort:** 2-3 hours

---

### 2. `src/services/pathwayAnalyzer.test.ts` ❌ NEW

**Purpose:** Test cascade reaction pattern analysis

**Test Cases:**

#### Pathway De-duplication
- [ ] Combines identical pathways from different loops
- [ ] Creates unique keys for each pathway
- [ ] Preserves reaction type (fusion vs. twotwo)
- [ ] Tracks all loop occurrences

#### Frequency & Energy Metrics
- [ ] Counts pathway frequency correctly
- [ ] Calculates average energy per occurrence
- [ ] Sums total energy across all occurrences
- [ ] Handles zero-energy reactions

#### Feedback Loop Detection
- [ ] Detects when output becomes input in later loop
- [ ] Marks feedback pathways correctly
- [ ] Handles multi-hop feedback chains
- [ ] Ignores non-feedback pathways

#### Rarity Scoring
- [ ] Calculates rarity score (0-100)
- [ ] Most frequent pathway scores 100
- [ ] Rare pathways score lower
- [ ] Handles single pathway edge case

#### Edge Cases
- [ ] Empty reaction array
- [ ] Single reaction
- [ ] All reactions identical
- [ ] No feedback loops present
- [ ] Complex multi-loop feedback

**Estimated Effort:** 3-4 hours

---

### 3. `src/hooks/useCascadeWorker.test.ts` ❌ NEW

**Purpose:** Test Web Worker lifecycle and progress tracking

**Test Cases:**

#### Worker Lifecycle
- [ ] Creates worker on mount
- [ ] Cleans up worker on unmount
- [ ] Handles multiple mount/unmount cycles
- [ ] Terminates worker properly

#### Progress Tracking
- [ ] Updates progress state during simulation
- [ ] Calculates percentage correctly
- [ ] Tracks loop numbers
- [ ] Reports new reaction counts
- [ ] Handles granular finalization progress

#### Cancellation
- [ ] `cancelCascade()` terminates worker
- [ ] Rejects promise on cancellation
- [ ] Clears progress state
- [ ] Prevents results from cancelled run

#### Error Handling
- [ ] Catches worker errors
- [ ] Sets error state
- [ ] Rejects promise on error
- [ ] Cleans up resources on error

#### Integration
- [ ] Accepts CascadeParameters correctly
- [ ] Serializes database buffer
- [ ] Receives CascadeResults
- [ ] Handles large result sets

**Testing Strategy:** Use Vitest with mock Worker API

**Estimated Effort:** 4-5 hours

---

## Missing Component Tests

Component testing for cascade UI can use:
- **React Testing Library** for unit-level component tests
- **Playwright Component Testing** for visual/interaction tests
- **Vitest** as test runner

### 1. PathwayBrowserTable Component ❌

**File:** `src/components/PathwayBrowserTable.tsx`
**Note:** Includes uncommitted responsive design changes (91 lines)

**Test Cases:**

#### Data Display
- [ ] Renders pathway data correctly
- [ ] Shows all columns (Type, Count, Avg, Total, Loops, Feedback, Rarity)
- [ ] Formats loop ranges ("0-12", "3, 7, 11")
- [ ] Displays reaction type badges (Fusion/2→2)
- [ ] Shows feedback checkmark for feedback loops

#### Sorting
- [ ] Sorts by frequency (default: descending)
- [ ] Sorts by avg energy
- [ ] Sorts by total energy
- [ ] Sorts by rarity score
- [ ] Sorts by earliest loop appearance
- [ ] Toggles ascending/descending
- [ ] Shows correct sort indicator (arrows)

#### Filtering
- [ ] Search filters by nuclide name
- [ ] Reaction type filters (Fusion/Two-to-Two checkboxes)
- [ ] Feedback-only filter
- [ ] Minimum frequency slider
- [ ] Filter combinations work together
- [ ] Updates result count

#### Virtualization
- [ ] Renders large datasets efficiently (10,000+ rows)
- [ ] Scrolls smoothly
- [ ] Shows correct rows in viewport
- [ ] Updates on filter/sort changes

#### Responsive Design (NEW - Uncommitted Changes)
- [ ] Desktop (≥768px): Shows all columns, pathway in first column
- [ ] Tablet (640-768px): Hides Feedback/Rarity, pathway in own row
- [ ] Mobile (<640px): Hides Loops, pathway in full-width row
- [ ] Table layout fixed maintains column alignment
- [ ] Header scrolls with body at extreme widths (<600px)
- [ ] Progressive column hiding works at all breakpoints

**Testing Strategy:**
- Unit tests with React Testing Library for logic
- Visual regression tests for responsive layout
- E2E tests for user interactions

**Estimated Effort:** 4-5 hours

---

### 2. NuclidePickerModal Component ❌

**File:** `src/components/NuclidePickerModal.tsx`

**Test Cases:**

#### Modal Behavior
- [ ] Opens when triggered
- [ ] Closes on cancel
- [ ] Closes on save
- [ ] Displays correct element name/symbol
- [ ] Traps focus when open

#### Nuclide Display
- [ ] Loads nuclides for selected element
- [ ] Shows mass number for each isotope
- [ ] Displays abundance percentage
- [ ] Color codes by abundance tier (abundant/trace/rare/synthetic)
- [ ] Indicates stable vs. radioactive

#### Selection Logic
- [ ] Toggles individual nuclide selection
- [ ] Shows checkmark for selected nuclides
- [ ] Persists selections on modal close
- [ ] Initializes with previously selected nuclides

#### Quick Select Buttons
- [ ] "Most Common" selects highest abundance
- [ ] "Abundant" selects all ≥1%
- [ ] "Stable" selects all stable isotopes
- [ ] "All" selects all nuclides
- [ ] "None" clears all selections

#### Edge Cases
- [ ] Element with no isotopes
- [ ] Element with only synthetic isotopes
- [ ] Element with single isotope
- [ ] Missing abundance data

**Estimated Effort:** 3-4 hours

---

### 3. CascadeProgressCard Component ❌

**File:** `src/components/CascadeProgressCard.tsx`

**Test Cases:**

#### Progress Display
- [ ] Shows current loop number
- [ ] Shows total loops
- [ ] Displays percentage complete
- [ ] Shows progress bar
- [ ] Updates in real-time during simulation

#### Status Messages
- [ ] "Initializing..." during setup
- [ ] "Loop X of Y" during execution
- [ ] "Finalizing..." during energy calculation
- [ ] "Complete!" on success
- [ ] "Cancelled" on user cancel
- [ ] Error message on failure

#### Cancellation
- [ ] Shows cancel button
- [ ] Button is clickable during simulation
- [ ] Triggers cancellation callback
- [ ] Hides button after completion

#### Granular Progress (NEW)
- [ ] Shows reaction count per loop
- [ ] Displays finalization batches
- [ ] Updates smoothly without flicker

**Estimated Effort:** 2-3 hours

---

### 4. CascadeTabs Component ❌

**File:** `src/components/CascadeTabs.tsx`

**Test Cases:**

#### Tab Navigation
- [ ] Shows all tabs (Summary, Network, Sankey, Pathways)
- [ ] Default tab is Summary
- [ ] Switches tabs on click
- [ ] Highlights active tab
- [ ] Maintains selection on re-render

#### Content Display
- [ ] Summary shows results overview
- [ ] Network shows ReactFlow diagram
- [ ] Sankey shows energy flow
- [ ] Pathways shows table
- [ ] No content shown before simulation

#### State Management
- [ ] Preserves tab selection during simulation
- [ ] Resets to Summary on new simulation
- [ ] Handles missing/empty results

**Estimated Effort:** 2 hours

---

### 5. Visualization Components (Lower Priority)

#### CascadeNetworkDiagram ❌
- Uses ReactFlow - primarily integration testing via E2E
- Unit test node/edge generation logic
- Snapshot tests for layout algorithm

#### CascadeSankeyDiagram ❌
- Uses Recharts - primarily integration testing via E2E
- Unit test data transformation logic
- Test color coding for fuel/intermediate/final nodes

**Estimated Effort:** 3-4 hours combined

---

## E2E Test Additions

### File: `e2e/cascade-simulation.spec.ts` (Additions)

#### Visualization Interactions

```typescript
test('should display network diagram with interactive nodes', async ({ page }) => {
  // Run simulation first
  // Switch to Network tab
  // Verify ReactFlow canvas renders
  // Check that nodes are visible
  // Test zoom/pan controls
  // Verify edge connections
});

test('should display Sankey energy flow diagram', async ({ page }) => {
  // Run simulation first
  // Switch to Sankey tab
  // Verify Recharts SVG renders
  // Check that flows are visible
  // Verify fuel nodes (green) and final nodes (red)
  // Test hover tooltips
});
```

#### Nuclide Picker Modal

```typescript
test('should open nuclide picker and select isotopes', async ({ page }) => {
  // Click on element in periodic table selector
  // Verify modal opens
  // Check isotopes are listed with abundances
  // Click individual nuclide
  // Use quick select button ("Most Common")
  // Save and verify selection appears in fuel list
});

test('should handle nuclide picker quick filters', async ({ page }) => {
  // Open modal for element with multiple isotopes (e.g., Ni)
  // Click "Abundant" - verify only ≥1% selected
  // Click "Stable" - verify only stable isotopes selected
  // Click "All" - verify all nuclides selected
  // Click "None" - verify all deselected
});
```

#### Pathway Browser Interactions

```typescript
test('should sort pathways by different columns', async ({ page }) => {
  // Run simulation first
  // Switch to Pathways tab
  // Click "Count" header - verify descending sort
  // Click again - verify ascending sort
  // Click "Avg (MeV)" - verify sorted by energy
  // Verify sort indicator (arrows) updates
});

test('should filter pathways by search term', async ({ page }) => {
  // Run simulation first
  // Switch to Pathways tab
  // Type nuclide name in search box (e.g., "Ni-58")
  // Verify filtered results contain search term
  // Verify result count updates
  // Clear search - verify all pathways shown
});

test('should filter pathways by reaction type', async ({ page }) => {
  // Run simulation first
  // Switch to Pathways tab
  // Uncheck "Fusion" checkbox
  // Verify only Two-to-Two reactions shown
  // Re-check "Fusion", uncheck "Two-to-Two"
  // Verify only Fusion reactions shown
});
```

#### Responsive Layout Testing

```typescript
test('should display responsive pathway table on mobile', async ({ page }) => {
  // Set mobile viewport (375px)
  // Run simulation
  // Switch to Pathways tab
  // Verify pathway appears in full-width row above data
  // Verify Loops/Feedback/Rarity columns hidden
  // Verify columns align correctly
});

test('should display responsive pathway table on tablet', async ({ page }) => {
  // Set tablet viewport (768px)
  // Run simulation
  // Switch to Pathways tab
  // Verify pathway in first column
  // Verify Feedback/Rarity columns hidden
  // Verify responsive breakpoints work
});

test('should handle horizontal scroll at extreme widths', async ({ page }) => {
  // Set very narrow viewport (320px)
  // Run simulation
  // Switch to Pathways tab
  // Verify table scrolls horizontally
  // Verify header and body scroll together
});
```

#### Tab Switching

```typescript
test('should switch between result tabs', async ({ page }) => {
  // Run simulation first
  // Default tab should be Summary
  // Click Network tab - verify diagram shown
  // Click Sankey tab - verify energy flow shown
  // Click Pathways tab - verify table shown
  // Click Summary tab - verify results overview shown
});
```

**Estimated Effort:** 6-8 hours

---

## Implementation Checklist

### Phase 1: High-Priority Unit Tests (8-10 hours)
- [ ] Create `src/services/isotopeService.test.ts`
  - [ ] Nuclide querying tests
  - [ ] Abundance filtering tests
  - [ ] Formatting tests
  - [ ] Edge cases
- [ ] Create `src/services/pathwayAnalyzer.test.ts`
  - [ ] De-duplication tests
  - [ ] Metrics calculation tests
  - [ ] Feedback detection tests
  - [ ] Rarity scoring tests
- [ ] Create `src/hooks/useCascadeWorker.test.ts`
  - [ ] Worker lifecycle tests
  - [ ] Progress tracking tests
  - [ ] Cancellation tests
  - [ ] Error handling tests

### Phase 2: Component Tests (11-15 hours)
- [ ] Create component tests for PathwayBrowserTable
  - [ ] Sorting tests
  - [ ] Filtering tests
  - [ ] Responsive layout tests (include uncommitted changes)
  - [ ] Virtualization tests
- [ ] Create component tests for NuclidePickerModal
  - [ ] Selection logic tests
  - [ ] Quick filter tests
  - [ ] Modal behavior tests
- [ ] Create component tests for CascadeProgressCard
  - [ ] Progress display tests
  - [ ] Cancellation tests
- [ ] Create component tests for CascadeTabs
  - [ ] Tab navigation tests
  - [ ] Content display tests

### Phase 3: E2E Test Additions (6-8 hours)
- [ ] Add visualization interaction tests
- [ ] Add nuclide picker E2E tests
- [ ] Add pathway browser E2E tests
- [ ] Add responsive layout E2E tests
- [ ] Add tab switching tests

### Phase 4: Validation & Documentation (2-3 hours)
- [ ] Run full test suite and verify coverage
- [ ] Update test documentation
- [ ] Add test examples to CLAUDE.md
- [ ] Generate coverage report

**Total Estimated Effort:** 27-36 hours

---

## Testing Commands

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test src/services/isotopeService.test.ts

# Run tests in watch mode
npm run test -- --watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- cascade-simulation

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run only Chromium browser
npm run test:e2e:chromium

# View test report
npm run test:e2e:report
```

### Combined Test Run

```bash
# Run both unit and E2E tests
npm run test:run && npm run test:e2e
```

---

## Success Criteria

### Coverage Goals
- [ ] ≥90% line coverage for cascade services
- [ ] ≥80% line coverage for cascade components
- [ ] All critical user paths covered by E2E tests
- [ ] All responsive breakpoints tested

### Quality Goals
- [ ] No flaky tests
- [ ] Fast test execution (<5 min for unit, <10 min for E2E)
- [ ] Clear test descriptions
- [ ] Comprehensive edge case coverage

### Documentation Goals
- [ ] All tests have descriptive names
- [ ] Complex test logic is commented
- [ ] Test utilities are documented
- [ ] README updated with test commands

---

## Notes

### Uncommitted Changes
- `src/components/PathwayBrowserTable.tsx` has 91 lines of uncommitted responsive design improvements
- These changes add two-tier row layout and progressive column hiding
- **Action Required:** Commit these changes before writing tests OR include them in the test implementation PR

### Testing Best Practices
1. **Isolation:** Each test should be independent
2. **Clarity:** Test names should describe expected behavior
3. **Speed:** Mock external dependencies (database, workers)
4. **Maintenance:** Use test utilities for common setup
5. **Coverage:** Focus on behavior, not implementation details

### CI/CD Integration
- Tests run automatically on PR creation
- E2E tests run on multiple browsers (Chromium, Firefox, WebKit)
- Coverage reports generated and tracked over time
- Failed tests block merge

---

**Document Version:** 1.0
**Last Updated:** 2025-10-24
**Owner:** Cascade Feature Team
