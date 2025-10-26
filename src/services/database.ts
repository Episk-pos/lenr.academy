import type { Database, SqlJsStatic } from 'sql.js';
import {
  getCachedDB,
  setCachedDB,
  clearOldVersions,
  clearAllCache,
  fetchMetadata,
  requestPersistentStorage,
  type CachedDatabase,
  type DatabaseMetadata,
} from './dbCache';

let db: Database | null = null;
let currentVersion: string | null = null;

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download database with progress tracking using streaming fetch
 */
async function downloadDatabaseWithProgress(
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const response = await fetch('/parkhomov.db');
  if (!response.ok) {
    throw new Error(`Failed to load database: ${response.statusText}`);
  }

  const contentLength = response.headers.get('Content-Length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    // Fallback if streaming not supported
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    downloadedBytes += value.length;

    if (onProgress && totalBytes > 0) {
      onProgress({
        downloadedBytes,
        totalBytes,
        percentage: (downloadedBytes / totalBytes) * 100,
      });
    }
  }

  // Combine chunks into single Uint8Array
  const combined = new Uint8Array(downloadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

/**
 * Initialize the SQL.js database with Parkhomov tables
 * Supports caching and background updates
 * OFFLINE-FIRST: Checks IndexedDB cache before attempting network requests
 */
export async function initDatabase(
  onProgress?: ProgressCallback,
  onUpdateAvailable?: (version: string) => void
): Promise<Database> {
  if (db) return db;

  // Request persistent storage
  await requestPersistentStorage();

  // Dynamic import of sql.js
  const initSqlJs = (await import('sql.js')).default;
  const SQL: SqlJsStatic = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  // OFFLINE-FIRST: Try to load from cache FIRST, before any network requests
  let cachedDB: CachedDatabase | null = null;

  try {
    cachedDB = await getCachedDB();
    if (cachedDB) {
      console.log(`💾 Found cached database version: ${cachedDB.version}`);

      try {
        // Load cached database immediately to make app functional
        db = new SQL.Database(cachedDB.data);
        
        // Validate database by running a simple query
        const result = db.exec('SELECT name FROM sqlite_master WHERE type="table" LIMIT 1');
        if (!result || result.length === 0) {
          throw new Error('Cached database appears to be empty or corrupted');
        }
        
        currentVersion = cachedDB.version;
        console.log('✅ Loaded database from cache');
      } catch (loadError) {
        console.warn('⚠️ Cached database is corrupted, clearing cache:', loadError);
        // Clear corrupted cache
        await clearAllCache();
        db = null;
        cachedDB = null;
        // Continue to download fresh database below
      }

      // Only check for updates if cache loaded successfully
      if (db && cachedDB) {
        // Background: Try to check for updates (don't block if offline)
        try {
          const metadata = await fetchMetadata();
          console.log(`📡 Server database version: ${metadata.version}`);

          // Check if update is available
          if (metadata.version !== cachedDB.version) {
            console.log(`🔄 Update available: ${cachedDB.version} → ${metadata.version}`);
            if (onUpdateAvailable) {
              onUpdateAvailable(metadata.version);
            }
            // Background update will be handled by DatabaseContext
          }
        } catch (metadataError) {
          // Offline or network error - that's OK, we already have cached database
          console.log('ℹ️ Could not check for updates (offline?), using cached version');
        }

        return db;
      }
    }
  } catch (cacheError) {
    console.warn('Failed to check cache:', cacheError);
  }

  // No cache - need to download database (first-time user or cache cleared)
  console.log('📥 No cached database found, downloading...');

  // Try to fetch metadata first to get version info
  let metadata: DatabaseMetadata | undefined;
  try {
    metadata = await fetchMetadata();
    console.log(`📡 Server database version: ${metadata.version}`);
  } catch (metadataError) {
    console.warn('⚠️ Could not fetch metadata (offline?), proceeding with download...');
  }

  try {
    console.log('⬇️ Downloading Parkhomov database...');
    const data = await downloadDatabaseWithProgress(onProgress);

    // Load into SQL.js
    db = new SQL.Database(data);
    
    // Validate database by running a simple query
    const result = db.exec('SELECT name FROM sqlite_master WHERE type="table" LIMIT 1');
    if (!result || result.length === 0) {
      throw new Error('Downloaded database appears to be empty or invalid');
    }
    
    console.log('✅ Parkhomov database loaded successfully');

    // Cache for next time
    if (metadata) {
      const cached: CachedDatabase = {
        version: metadata.version,
        data,
        size: data.length,
        downloadedAt: Date.now(),
        lastModified: metadata.lastModified,
      };
      await setCachedDB(cached);
      currentVersion = metadata.version;
    } else {
      // No metadata, but cache anyway with unknown version
      const cached: CachedDatabase = {
        version: 'unknown',
        data,
        size: data.length,
        downloadedAt: Date.now(),
      };
      await setCachedDB(cached);
      currentVersion = 'unknown';
    }

    return db;
  } catch (downloadError) {
    console.error('❌ Failed to download database:', downloadError);

    // Final fallback: create empty database with sample data
    console.log('📝 Creating fallback database with sample data...');
    db = new SQL.Database();
    createTables(db);
    populateSampleData(db);
    return db;
  }
}

/**
 * Download and cache a new database version in the background
 */
export async function downloadUpdate(
  targetVersion: string,
  onProgress?: ProgressCallback
): Promise<void> {
  try {
    console.log(`⬇️ Downloading database update to version ${targetVersion}...`);

    const initSqlJs = (await import('sql.js')).default;
    const SQL: SqlJsStatic = await initSqlJs({
      locateFile: (file) => `/${file}`,
    });

    // Download new version
    const data = await downloadDatabaseWithProgress(onProgress);

    // Verify it loads correctly
    const testDB = new SQL.Database(data);
    testDB.close();

    // Cache the new version
    const metadata = await fetchMetadata();
    const cached: CachedDatabase = {
      version: targetVersion,
      data,
      size: data.length,
      downloadedAt: Date.now(),
      lastModified: metadata.lastModified,
    };

    await setCachedDB(cached);
    console.log(`✅ Database update cached (version ${targetVersion})`);

    // Clean up old versions
    await clearOldVersions(targetVersion);
  } catch (error) {
    console.error('Failed to download update:', error);
    throw error;
  }
}

/**
 * Get current database version
 */
export function getCurrentVersion(): string | null {
  return currentVersion;
}

/**
 * Get the initialized database instance
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Create all necessary tables
 */
function createTables(db: Database): void {
  // NuclidesPlus table
  db.run(`
    CREATE TABLE IF NOT EXISTS NuclidesPlus (
      id INTEGER PRIMARY KEY,
      Z INTEGER NOT NULL,
      A INTEGER NOT NULL,
      E TEXT NOT NULL,
      BE REAL NOT NULL,
      AMU REAL NOT NULL,
      nBorF TEXT NOT NULL,
      aBorF TEXT NOT NULL,
      LHL REAL
    );
  `);

  // ElementsPlus table
  db.run(`
    CREATE TABLE IF NOT EXISTS ElementsPlus (
      Z INTEGER PRIMARY KEY,
      E TEXT NOT NULL,
      EName TEXT NOT NULL,
      Period INTEGER NOT NULL,
      [Group] INTEGER NOT NULL,
      AWeight REAL,
      ARadius INTEGER,
      MolarVolume REAL,
      Melting REAL,
      Boiling REAL,
      Negativity REAL,
      Affinity REAL,
      Valence INTEGER,
      MaxIonNum INTEGER,
      MaxIonization REAL,
      STPDensity REAL,
      ElectConduct REAL,
      ThermConduct REAL,
      SpecHeat REAL,
      MagType TEXT
    );
  `);

  // FusionAll table (E1 + E2 → E)
  db.run(`
    CREATE TABLE IF NOT EXISTS FusionAll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      E1 TEXT NOT NULL,
      Z1 INTEGER NOT NULL,
      A1 INTEGER NOT NULL,
      E2 TEXT NOT NULL,
      Z2 INTEGER NOT NULL,
      A2 INTEGER NOT NULL,
      E TEXT NOT NULL,
      Z INTEGER NOT NULL,
      A INTEGER NOT NULL,
      MeV REAL NOT NULL,
      neutrino TEXT NOT NULL,
      nBorF1 TEXT NOT NULL,
      aBorF1 TEXT NOT NULL,
      nBorF2 TEXT NOT NULL,
      aBorF2 TEXT NOT NULL,
      nBorF TEXT NOT NULL,
      aBorF TEXT NOT NULL,
      BEin REAL
    );
  `);

  // FissionAll table
  db.run(`
    CREATE TABLE IF NOT EXISTS FissionAll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      E TEXT NOT NULL,
      Z INTEGER NOT NULL,
      A INTEGER NOT NULL,
      E1 TEXT NOT NULL,
      Z1 INTEGER NOT NULL,
      A1 INTEGER NOT NULL,
      E2 TEXT NOT NULL,
      Z2 INTEGER NOT NULL,
      A2 INTEGER NOT NULL,
      MeV REAL NOT NULL,
      neutrino TEXT NOT NULL,
      nBorF TEXT NOT NULL,
      aBorF TEXT NOT NULL,
      nBorF1 TEXT NOT NULL,
      aBorF1 TEXT NOT NULL,
      nBorF2 TEXT NOT NULL,
      aBorF2 TEXT NOT NULL,
      BEin REAL
    );
  `);

  // TwoToTwoAll table
  db.run(`
    CREATE TABLE IF NOT EXISTS TwoToTwoAll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      E1 TEXT NOT NULL,
      Z1 INTEGER NOT NULL,
      A1 INTEGER NOT NULL,
      E2 TEXT NOT NULL,
      Z2 INTEGER NOT NULL,
      A2 INTEGER NOT NULL,
      E3 TEXT NOT NULL,
      Z3 INTEGER NOT NULL,
      A3 INTEGER NOT NULL,
      E4 TEXT NOT NULL,
      Z4 INTEGER NOT NULL,
      A4 INTEGER NOT NULL,
      MeV REAL NOT NULL,
      neutrino TEXT NOT NULL,
      nBorF1 TEXT NOT NULL,
      aBorF1 TEXT NOT NULL,
      nBorF2 TEXT NOT NULL,
      aBorF2 TEXT NOT NULL,
      nBorF3 TEXT NOT NULL,
      aBorF3 TEXT NOT NULL,
      nBorF4 TEXT NOT NULL,
      aBorF4 TEXT NOT NULL,
      BEin REAL
    );
  `);

  // Create indexes for performance
  db.run('CREATE INDEX IF NOT EXISTS idx_fusion_e1 ON FusionAll(E1);');
  db.run('CREATE INDEX IF NOT EXISTS idx_fusion_e2 ON FusionAll(E2);');
  db.run('CREATE INDEX IF NOT EXISTS idx_fusion_mev ON FusionAll(MeV);');
  db.run('CREATE INDEX IF NOT EXISTS idx_fission_e ON FissionAll(E);');
  db.run('CREATE INDEX IF NOT EXISTS idx_fission_mev ON FissionAll(MeV);');
  db.run('CREATE INDEX IF NOT EXISTS idx_twotwo_e1 ON TwoToTwoAll(E1);');
  db.run('CREATE INDEX IF NOT EXISTS idx_twotwo_e2 ON TwoToTwoAll(E2);');
  db.run('CREATE INDEX IF NOT EXISTS idx_twotwo_mev ON TwoToTwoAll(MeV);');
  db.run('CREATE INDEX IF NOT EXISTS idx_nuclides_z ON NuclidesPlus(Z);');
  db.run('CREATE INDEX IF NOT EXISTS idx_nuclides_e ON NuclidesPlus(E);');
}

/**
 * Populate database with expanded sample data
 */
function populateSampleData(db: Database): void {
  // Insert Elements
  const elements = [
    [1, 'H', 'Hydrogen', 1, 1, 1.008, 53, 11.42, 14.01, 20.28, -2.2, 72.8, 1, 1, 1312, 0.0899, null, null, 14304, null],
    [2, 'He', 'Helium', 1, 18, 4.003, 31, 22.56, 0.95, 4.22, null, 0, 0, 0, 2372.3, 0.1785, null, 0.1513, 5193, null],
    [3, 'Li', 'Lithium', 2, 1, 6.941, 167, 13.02, 453.69, 1615, 0.98, 59.6, 1, 1, 520.2, 535, 10.8, 84.8, 3582, null],
    [5, 'B', 'Boron', 2, 13, 10.811, 87, 4.39, 2349, 4200, 2.04, 26.7, 3, 3, 800.6, 2460, null, 27, 1026, null],
    [6, 'C', 'Carbon', 2, 14, 12.011, 67, 5.29, 3823, 4098, 2.55, 153.9, 4, 4, 1086.5, 2267, null, 140, 709, null],
    [7, 'N', 'Nitrogen', 2, 15, 14.007, 56, 13.54, 63.15, 77.36, 3.04, -7, 5, 3, 1402.3, 1.251, null, 0.02583, 1040, null],
    [8, 'O', 'Oxygen', 2, 16, 15.999, 48, 14, 54.36, 90.20, 3.44, 141, 2, 2, 1313.9, 1.429, null, 0.02658, 918, null],
    [9, 'F', 'Fluorine', 2, 17, 18.998, 42, 11.2, 53.53, 85.03, 3.98, 328, 1, 1, 1681, 1.7, null, 0.0277, 824, null],
    [13, 'Al', 'Aluminum', 3, 13, 26.982, 118, 10, 933.47, 2792, 1.61, 42.5, 3, 3, 577.5, 2700, 37.7, 235, 897, null],
    [14, 'Si', 'Silicon', 3, 14, 28.086, 111, 12.06, 1687, 3538, 1.9, 133.6, 4, 4, 786.5, 2330, null, 149, 705, null],
    [24, 'Cr', 'Chromium', 4, 6, 51.996, 166, 7.23, 2180, 2944, 1.66, 64.3, 6, 6, 652.9, 7190, 7.9, 93.9, 449, 'Ferromagnetic'],
    [26, 'Fe', 'Iron', 4, 8, 55.845, 156, 7.09, 1811, 3134, 1.83, 15.7, 3, 3, 762.5, 7874, 10, 80.4, 449, 'Ferromagnetic'],
    [28, 'Ni', 'Nickel', 4, 10, 58.693, 149, 6.59, 1728, 3186, 1.91, 112, 2, 4, 737.1, 8908, 14.3, 90.9, 444, 'Ferromagnetic'],
    [29, 'Cu', 'Copper', 4, 11, 63.546, 145, 7.11, 1357.77, 2835, 1.9, 118.4, 2, 2, 745.5, 8960, 59.6, 401, 385, null],
    [47, 'Ag', 'Silver', 5, 11, 107.868, 160, 10.27, 1234.93, 2435, 1.93, 125.6, 1, 3, 731, 10490, 63, 429, 235, null],
    [50, 'Sn', 'Tin', 5, 14, 118.710, 145, 16.29, 505.08, 2875, 1.96, 107.3, 4, 4, 708.6, 7310, 9.17, 66.8, 228, null],
    [79, 'Au', 'Gold', 6, 11, 196.967, 174, 10.2, 1337.33, 3129, 2.54, 222.8, 3, 3, 890.1, 19300, 45.2, 318, 129, null],
    [82, 'Pb', 'Lead', 6, 14, 207.2, 154, 18.26, 600.61, 2022, 2.33, 35.1, 4, 4, 715.6, 11340, 4.81, 35.3, 129, null],
  ];

  const insertElement = db.prepare(`
    INSERT INTO ElementsPlus (Z, E, EName, Period, [Group], AWeight, ARadius, MolarVolume,
      Melting, Boiling, Negativity, Affinity, Valence, MaxIonNum, MaxIonization,
      STPDensity, ElectConduct, ThermConduct, SpecHeat, MagType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  elements.forEach(row => insertElement.run(row));
  insertElement.free();

  // Insert Nuclides
  const nuclides = [
    [1, 1, 1, 'H', 0, 1.00783, 'f', 'b', null],
    [2, 1, 2, 'D', 2.224, 2.01410, 'b', 'f', null],
    [3, 1, 3, 'T', 8.482, 3.01605, 'f', 'b', 1.09],
    [4, 2, 3, 'He', 7.718, 3.01603, 'f', 'b', null],
    [5, 2, 4, 'He', 28.296, 4.00260, 'b', 'b', null],
    [6, 3, 6, 'Li', 31.995, 6.01512, 'b', 'f', null],
    [7, 3, 7, 'Li', 39.245, 7.01600, 'f', 'b', null],
    [8, 5, 10, 'B', 64.751, 10.01294, 'b', 'f', null],
    [9, 5, 11, 'B', 76.205, 11.00931, 'f', 'b', null],
    [10, 6, 12, 'C', 92.162, 12.00000, 'b', 'b', null],
    [11, 6, 13, 'C', 97.108, 13.00335, 'f', 'b', null],
    [12, 7, 14, 'N', 104.659, 14.00307, 'b', 'f', null],
    [13, 7, 15, 'N', 115.492, 15.00011, 'f', 'b', null],
    [14, 8, 16, 'O', 127.619, 15.99491, 'b', 'b', null],
    [15, 8, 17, 'O', 131.763, 16.99913, 'f', 'b', null],
    [16, 8, 18, 'O', 139.808, 17.99916, 'b', 'b', null],
    [17, 13, 27, 'Al', 224.952, 26.98154, 'f', 'b', null],
    [18, 14, 28, 'Si', 236.537, 27.97693, 'b', 'b', null],
    [19, 14, 29, 'Si', 245.020, 28.97649, 'f', 'b', null],
    [20, 14, 30, 'Si', 255.623, 29.97377, 'b', 'b', null],
    [21, 24, 52, 'Cr', 456.348, 51.94051, 'b', 'b', null],
    [22, 26, 56, 'Fe', 492.258, 55.93494, 'b', 'b', null],
    [23, 28, 58, 'Ni', 506.459, 57.93535, 'b', 'b', null],
    [24, 28, 60, 'Ni', 526.846, 59.93079, 'b', 'b', null],
    [25, 28, 61, 'Ni', 533.573, 60.93106, 'f', 'b', null],
    [26, 28, 62, 'Ni', 545.259, 61.92835, 'b', 'b', null],
    [27, 28, 64, 'Ni', 559.301, 63.92797, 'b', 'b', null],
    [28, 29, 63, 'Cu', 551.384, 62.92960, 'f', 'b', null],
    [29, 29, 65, 'Cu', 569.203, 64.92779, 'f', 'b', null],
    [30, 50, 120, 'Sn', 1020.516, 119.90220, 'b', 'b', null],
    [31, 82, 206, 'Pb', 1622.327, 205.97446, 'b', 'b', null],
    [32, 82, 207, 'Pb', 1629.076, 206.97589, 'f', 'b', null],
    [33, 82, 208, 'Pb', 1636.447, 207.97665, 'b', 'b', null],
  ];

  const insertNuclide = db.prepare(`
    INSERT INTO NuclidesPlus (id, Z, A, E, BE, AMU, nBorF, aBorF, LHL)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  nuclides.forEach(row => insertNuclide.run(row));
  insertNuclide.free();

  // Insert Fusion Reactions (E1 + E2 → E)
  const fusionReactions = [
    // H + H → D + e+ + ν
    ['H', 1, 1, 'H', 1, 1, 'D', 1, 2, 0.42, 'none', 'f', 'b', 'f', 'b', 'b', 'f', 0],
    // H + H → He
    ['H', 1, 1, 'H', 1, 1, 'He', 2, 4, 24.69, 'none', 'f', 'b', 'f', 'b', 'b', 'b', 0],
    // D + D → He
    ['D', 1, 2, 'D', 1, 2, 'He', 2, 4, 23.85, 'none', 'b', 'f', 'b', 'f', 'b', 'b', 2.224],
    // D + He → Li
    ['D', 1, 2, 'He', 2, 4, 'Li', 3, 6, 1.47, 'none', 'b', 'f', 'b', 'b', 'b', 'f', 2.224],
    // H + Li → Li
    ['H', 1, 1, 'Li', 3, 6, 'Li', 3, 7, 4.02, 'none', 'f', 'b', 'b', 'f', 'f', 'b', 0],
    // H + Li-6 → Li-7
    ['H', 1, 1, 'Li', 3, 6, 'Li', 3, 7, 5.61, 'none', 'f', 'b', 'b', 'f', 'f', 'b', 0],
    // D + Li → B
    ['D', 1, 2, 'Li', 3, 7, 'B', 5, 10, 4.77, 'none', 'b', 'f', 'f', 'b', 'b', 'f', 2.224],
    // H + B → C
    ['H', 1, 1, 'B', 5, 11, 'C', 6, 12, 8.68, 'none', 'f', 'b', 'f', 'b', 'b', 'b', 0],
    // D + B → C
    ['D', 1, 2, 'B', 5, 11, 'C', 6, 13, 8.00, 'none', 'b', 'f', 'f', 'b', 'f', 'b', 2.224],
    // H + C → N
    ['H', 1, 1, 'C', 6, 13, 'N', 7, 14, 1.94, 'none', 'f', 'b', 'f', 'b', 'b', 'f', 0],
    // D + N → O
    ['D', 1, 2, 'N', 7, 15, 'O', 8, 17, 2.27, 'none', 'b', 'f', 'f', 'b', 'f', 'b', 2.224],
    // H + O → F
    ['H', 1, 1, 'O', 8, 17, 'F', 9, 18, 0.60, 'none', 'f', 'b', 'f', 'b', 'f', 'b', 0],
    // Li + Li → Si
    ['Li', 3, 7, 'Li', 3, 7, 'Si', 14, 28, 7.13, 'none', 'f', 'b', 'f', 'b', 'b', 'b', 39.245],
    // Li + B → Al
    ['Li', 3, 7, 'B', 5, 10, 'Al', 13, 27, 6.21, 'none', 'f', 'b', 'b', 'f', 'f', 'b', 39.245],
  ];

  const insertFusion = db.prepare(`
    INSERT INTO FusionAll (E1, Z1, A1, E2, Z2, A2, E, Z, A, MeV, neutrino, nBorF1, aBorF1, nBorF2, aBorF2, nBorF, aBorF, BEin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  fusionReactions.forEach(row => insertFusion.run(row));
  insertFusion.free();

  // Insert Fission Reactions (expanded set)
  const fissionReactions = [
    ['Pb', 82, 208, 'Ni', 28, 58, 'Sn', 50, 120, 15.32, 'none', 'b', 'b', 'b', 'b', 'b', 'b', 1636.447],
    ['Pb', 82, 208, 'Fe', 26, 56, 'Sn', 50, 120, 18.45, 'none', 'b', 'b', 'b', 'b', 'b', 'b', 1636.447],
    ['Pb', 82, 207, 'Ni', 28, 58, 'Sn', 50, 120, 12.54, 'none', 'f', 'b', 'b', 'b', 'b', 'b', 1629.076],
    ['Pb', 82, 206, 'Ni', 28, 60, 'Sn', 50, 120, 8.43, 'none', 'b', 'b', 'b', 'b', 'b', 'b', 1622.327],
    ['Au', 79, 197, 'Cu', 29, 63, 'Sn', 50, 120, 12.89, 'none', 'f', 'b', 'f', 'b', 'b', 'b', 1559.40],
    ['Sn', 50, 120, 'Ni', 28, 58, 'Ni', 28, 62, 5.73, 'none', 'b', 'b', 'b', 'b', 'b', 'b', 1020.516],
  ];

  const insertFission = db.prepare(`
    INSERT INTO FissionAll (E, Z, A, E1, Z1, A1, E2, Z2, A2, MeV, neutrino, nBorF, aBorF, nBorF1, aBorF1, nBorF2, aBorF2, BEin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  fissionReactions.forEach(row => insertFission.run(row));
  insertFission.free();

  // Insert TwoToTwo Reactions (expanded set)
  const twoToTwoReactions = [
    ['H', 1, 1, 'Ni', 28, 58, 'Li', 3, 7, 'Cr', 24, 52, 12.45, 'none', 'f', 'b', 'b', 'b', 'f', 'b', 'b', 'b', 506.459],
    ['H', 1, 1, 'Ni', 28, 60, 'Li', 3, 7, 'Cr', 24, 52, 5.85, 'none', 'f', 'b', 'b', 'b', 'f', 'b', 'b', 'b', 526.846],
    ['H', 1, 1, 'Ni', 28, 62, 'Li', 3, 7, 'Fe', 26, 56, 10.32, 'none', 'f', 'b', 'b', 'b', 'f', 'b', 'b', 'b', 545.259],
    ['D', 1, 2, 'Ni', 28, 58, 'He', 2, 4, 'Fe', 26, 56, 18.71, 'none', 'b', 'f', 'b', 'b', 'b', 'b', 'b', 'b', 508.683],
    ['D', 1, 2, 'Ni', 28, 60, 'Li', 3, 6, 'Cr', 24, 52, 11.38, 'none', 'b', 'f', 'b', 'b', 'b', 'f', 'b', 'b', 529.07],
    ['H', 1, 1, 'Li', 3, 7, 'He', 2, 4, 'He', 2, 4, 17.35, 'none', 'f', 'b', 'f', 'b', 'b', 'b', 'b', 'b', 39.245],
    ['D', 1, 2, 'Li', 3, 6, 'He', 2, 4, 'He', 2, 4, 22.37, 'none', 'b', 'f', 'b', 'f', 'b', 'b', 'b', 'b', 34.219],
    ['Li', 3, 7, 'Ni', 28, 58, 'Al', 13, 27, 'Fe', 26, 56, 14.28, 'none', 'f', 'b', 'b', 'b', 'f', 'b', 'b', 'b', 545.704],
    ['Li', 3, 7, 'Al', 13, 27, 'Si', 14, 28, 'Si', 14, 28, 9.54, 'none', 'f', 'b', 'f', 'b', 'b', 'b', 'b', 'b', 264.197],
    ['B', 5, 11, 'Ni', 28, 58, 'Al', 13, 27, 'Cr', 24, 52, 15.79, 'none', 'f', 'b', 'b', 'b', 'f', 'b', 'b', 'b', 582.664],
    ['N', 7, 14, 'Ni', 28, 58, 'O', 8, 16, 'Fe', 26, 56, 7.92, 'none', 'b', 'f', 'b', 'b', 'b', 'b', 'b', 'b', 611.118],
  ];

  const insertTwoToTwo = db.prepare(`
    INSERT INTO TwoToTwoAll (E1, Z1, A1, E2, Z2, A2, E3, Z3, A3, E4, Z4, A4, MeV, neutrino,
      nBorF1, aBorF1, nBorF2, aBorF2, nBorF3, aBorF3, nBorF4, aBorF4, BEin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  twoToTwoReactions.forEach(row => insertTwoToTwo.run(row));
  insertTwoToTwo.free();

  console.log('✅ Database initialized with sample Parkhomov data');
}

/**
 * Export database to file (for saving/loading)
 */
export function exportDatabase(): Uint8Array {
  if (!db) throw new Error('Database not initialized');
  return db.export();
}

/**
 * Import database from file
 */
export async function importDatabase(data: Uint8Array): Promise<Database> {
  // Dynamic import of sql.js - Vite will handle the CommonJS to ESM conversion
  const initSqlJs = (await import('sql.js')).default;

  // Initialize SQL.js - use local WASM file from public directory
  const SQL: SqlJsStatic = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  db = new SQL.Database(data);
  return db;
}
