-- Migration script to fix incorrect column types in parkhomov.db
-- Issue: NuclidesPlus.LHL and ElementPropertiesPlus.Val are TEXT but contain numeric data
-- Date: 2025-10-12

BEGIN TRANSACTION;

-- ============================================================================
-- Fix NuclidesPlus.LHL: TEXT -> REAL
-- ============================================================================
-- LHL stores log10 of half-life in years, used in mathematical operations
-- Current values like "50.0000", "-4.6070", "1.0906" are stored as TEXT

-- Step 1: Add new column with correct type
ALTER TABLE NuclidesPlus ADD COLUMN LHL_new REAL;

-- Step 2: Cast and copy data from old column to new column
UPDATE NuclidesPlus SET LHL_new = CAST(LHL AS REAL) WHERE LHL IS NOT NULL;

-- Step 3: Drop old TEXT column
ALTER TABLE NuclidesPlus DROP COLUMN LHL;

-- Step 4: Rename new column to original name
ALTER TABLE NuclidesPlus RENAME COLUMN LHL_new TO LHL;

-- ============================================================================
-- Fix ElementPropertiesPlus.Val: TEXT -> INTEGER
-- ============================================================================
-- Val stores valence as integer values like "1", "2", "3"

-- Step 1: Add new column with correct type
ALTER TABLE ElementPropertiesPlus ADD COLUMN Val_new INTEGER;

-- Step 2: Cast and copy data from old column to new column
UPDATE ElementPropertiesPlus SET Val_new = CAST(Val AS INTEGER) WHERE Val IS NOT NULL;

-- Step 3: Drop old TEXT column
ALTER TABLE ElementPropertiesPlus DROP COLUMN Val;

-- Step 4: Rename new column to original name
ALTER TABLE ElementPropertiesPlus RENAME COLUMN Val_new TO Val;

COMMIT;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Run these after migration to verify correctness:
--
-- SELECT typeof(LHL), LHL FROM NuclidesPlus WHERE LHL IS NOT NULL LIMIT 5;
-- Expected: All should show "real" type
--
-- SELECT typeof(Val), Val FROM ElementPropertiesPlus WHERE Val IS NOT NULL LIMIT 5;
-- Expected: All should show "integer" type
--
-- SELECT E, A, LHL FROM NuclidesPlus WHERE LHL > 9 ORDER BY LHL DESC LIMIT 10;
-- Expected: Numeric sorting (e.g., 50 > 9, not alphabetic where "9" > "50")
--
-- SELECT E, EName, Val FROM ElementPropertiesPlus WHERE Val >= 3 ORDER BY Val LIMIT 10;
-- Expected: Numeric comparison and sorting
