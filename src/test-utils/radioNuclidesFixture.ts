/**
 * In-memory sql.js database seeded with real rows copied verbatim from
 * parkhomov.db v1.2.2, for tests that need the actual RadioNuclides quirks:
 * - NuclidesPlus uses the symbols H / D / T, while RadioNuclides files tritium
 *   under 'H' (Z=1, A=3).
 * - RadioNuclides mixes ground-state and isomer rows under the same Z/A, and an
 *   isomer row can be the most intense one (Co-60m IT RI=125 vs Co-60 B- 99.99;
 *   Cs-135m; Ba-137m under stable Ba-137).
 */
import { createRequire } from 'node:module';
import initSqlJs, { type Database } from 'sql.js';

const FIXTURE_SQL = `
    CREATE TABLE NuclidesPlus (id INTEGER PRIMARY KEY, A INTEGER, Z INTEGER, E TEXT, LHL REAL, RDM TEXT, SUS TEXT);
    INSERT INTO NuclidesPlus VALUES
      (3, 1, 1, 'H', 50.0, NULL, 'SPN'),
      (4, 2, 1, 'D', 50.0, NULL, 'SPN'),
      (5, 3, 1, 'T', 1.0906, 'B-', 'SYN'),
      (69, 60, 27, 'Co', 0.7219, 'G, B-', 'SYN'),
      (188, 137, 56, 'Ba', 50.0, NULL, 'SPN'),
      (310, 135, 55, 'Cs', 6.3617, 'B-', 'UPN'),
      (291, 238, 92, 'U', 9.6504, 'A or SF or 2 B-', 'UPN'),
      (250, 180, 73, 'Ta', 15.0, NULL, 'SPN');
    CREATE TABLE ElementPropertiesPlus (Z INTEGER PRIMARY KEY, E TEXT, EName TEXT);
    INSERT INTO ElementPropertiesPlus VALUES
      (1, 'H', 'Hydrogen'), (2, 'He', 'Helium'), (26, 'Fe', 'Iron'), (27, 'Co', 'Cobalt'),
      (28, 'Ni', 'Nickel'), (55, 'Cs', 'Caesium'), (56, 'Ba', 'Barium'), (72, 'Hf', 'Hafnium'),
      (73, 'Ta', 'Tantalum'), (74, 'W', 'Tungsten'), (90, 'Th', 'Thorium'), (92, 'U', 'Uranium');
    CREATE TABLE RadioNuclides (
      id INTEGER PRIMARY KEY, A INTEGER, E TEXT, Z INTEGER, RDM TEXT, HL REAL,
      Units TEXT, LHL REAL, RT TEXT, DEKeV REAL, RI REAL
    );
    INSERT INTO RadioNuclides VALUES
      (1, 3, 'H', 1, 'B-', 12.33, 'Y', 1.091, 'B-', 5.69, 100.0),
      (896, 60, 'Co', 27, 'IT', 10.467, 'M', -4.7011, 'E-AU-L', 0.75, 125.0),
      (894, 60, 'Co', 27, 'B-', 5.2714, 'Y', 0.7219, 'G', 1332.501, 99.9856),
      (890, 60, 'Co', 27, 'B-', 5.2714, 'Y', 0.7219, 'B-', 95.77, 99.925),
      (898, 60, 'Co', 27, 'IT', 10.467, 'M', -4.7011, 'E-CE-K', 50.894, 79.08),
      (15719, 137, 'Ba', 56, 'IT', 2.552, 'M', -5.3141, 'G', 661.657, 90.11),
      (15713, 137, 'Ba', 56, 'IT', 2.552, 'M', -5.3141, 'E-CE-K', 624.216, 8.12),
      (15407, 135, 'Cs', 55, 'IT', 53.0, 'M', -3.9967, 'G', 787.2, 100.0),
      (15409, 135, 'Cs', 55, 'B-', 2300000.0, 'Y', 6.3617, 'B-', 75.9, 100.0),
      (15408, 135, 'Cs', 55, 'IT', 53.0, 'M', -3.9967, 'G', 846.1, 96.0),
      (44721, 238, 'U', 92, 'A', 4470000000.0, 'Y', 9.6503, 'A', 4198.0, 79.0),
      (44720, 238, 'U', 92, 'A', 4470000000.0, 'Y', 9.6503, 'A', 4151.0, 21.0),
      (29976, 180, 'Ta', 73, 'EC', 8.152, 'H', -3.0315, 'E-AU-L', 6.18, 63.0),
      (29975, 180, 'Ta', 73, 'B-', 8.152, 'H', -3.0315, 'B-', 223.0, 10.4);
  `;

export async function createRadioNuclidesFixtureDb(): Promise<Database> {
  const require = createRequire(import.meta.url);
  const SQL = await initSqlJs({
    locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = new SQL.Database();
  db.run(FIXTURE_SQL);
  return db;
}
