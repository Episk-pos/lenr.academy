#!/usr/bin/env python3
"""
Rebuild the Parkhomov database from CSV files.
Deletes existing database and creates fresh one from src/data/*.csv files.
"""
import sqlite3
import csv
from pathlib import Path

DB_PATH = 'public/parkhomov.db'

# Table definitions with their CSV sources
TABLES = {
    'FusionAll': {
        'csv': 'src/data/fusion_all.csv',
        'schema': '''
            CREATE TABLE FusionAll (
                id INTEGER PRIMARY KEY,
                neutrino TEXT,
                id_sub INTEGER,
                E1 TEXT, A1 INTEGER, nBorF1 TEXT, Z1 INTEGER, aBorF1 TEXT,
                E2 TEXT, A2 INTEGER, nBorF2 TEXT, Z2 INTEGER, aBorF2 TEXT,
                E TEXT, A INTEGER, nBorF TEXT, Z INTEGER, aBorF TEXT,
                MeV REAL
            )
        '''
    },
    'FissionAll': {
        'csv': 'src/data/fission_all.csv',
        'schema': '''
            CREATE TABLE FissionAll (
                id INTEGER PRIMARY KEY,
                neutrino TEXT,
                E TEXT, A INTEGER, nBorF TEXT, Z INTEGER, aBorF TEXT,
                E1 TEXT, A1 INTEGER, nBorF1 TEXT, Z1 INTEGER, aBorF1 TEXT,
                E2 TEXT, A2 INTEGER, nBorF2 TEXT, Z2 INTEGER, aBorF2 TEXT,
                MeV REAL
            )
        '''
    },
    'TwoToTwoAll': {
        'csv': 'src/data/twotwo_all.csv',
        'schema': '''
            CREATE TABLE TwoToTwoAll (
                id INTEGER PRIMARY KEY,
                neutrino TEXT,
                id_sub INTEGER,
                E1 TEXT, A1 INTEGER, nBorF1 TEXT, Z1 INTEGER, aBorF1 TEXT,
                E2 TEXT, A2 INTEGER, nBorF2 TEXT, Z2 INTEGER, aBorF2 TEXT,
                E3 TEXT, A3 INTEGER, nBorF3 TEXT, Z3 INTEGER, aBorF3 TEXT,
                E4 TEXT, A4 INTEGER, nBorF4 TEXT, Z4 INTEGER, aBorF4 TEXT,
                MeV REAL
            )
        '''
    },
    'NuclidesPlus': {
        'csv': 'src/data/nuclides_plus.csv',
        'schema': '''
            CREATE TABLE NuclidesPlus (
                id INTEGER PRIMARY KEY,
                A INTEGER, Z INTEGER, nBorF TEXT, aBorF TEXT,
                E TEXT, AMU REAL, BE REAL, BEN REAL, SUS TEXT,
                LHL TEXT, RDM TEXT, DEMeV REAL,
                pcaNCrust REAL, ppmNCrust REAL, ppmNSolar REAL,
                SP TEXT, MD TEXT, EQ TEXT, RCPT TEXT,
                Inova_MHz REAL, MagGR REAL
            )
        '''
    },
    'ElementPropertiesPlus': {
        'csv': 'src/data/element_properties_plus.csv',
        'schema': '''
            CREATE TABLE ElementPropertiesPlus (
                Z INTEGER PRIMARY KEY,
                E TEXT, EName TEXT, P INTEGER, G INTEGER,
                AWeight REAL, ARadius REAL, MolarVol REAL,
                Melting REAL, Boiling REAL, Negativity REAL,
                Affinity REAL, Val TEXT, MxInum INTEGER, MxInize REAL,
                STPDensity REAL, ElectG REAL, ThermG REAL, SpecHeat REAL,
                ppmECrust REAL, ppmEStellar REAL,
                MagType TEXT, CuriePtK REAL, MagVolSus REAL
            )
        '''
    },
    'AtomicRadii': {
        'csv': 'src/data/atomic_radii.csv',
        'schema': '''
            CREATE TABLE AtomicRadii (
                Z INTEGER PRIMARY KEY,
                E TEXT, EName TEXT,
                AtRadEmpirical REAL, AtRadCalculated REAL,
                AtRadVanDerWaals REAL, AtRadCovalent REAL
            )
        '''
    },
    'RadioNuclides': {
        'csv': 'src/data/radionuclides.csv',
        'schema': '''
            CREATE TABLE RadioNuclides (
                id INTEGER PRIMARY KEY,
                A INTEGER, E TEXT, Z INTEGER,
                RDM TEXT, HL REAL, Units TEXT, LHL REAL,
                RT TEXT, DEKeV REAL, RI REAL
            )
        '''
    }
}

def delete_database():
    """Delete existing database file"""
    db_file = Path(DB_PATH)
    if db_file.exists():
        print(f"Deleting existing database: {DB_PATH}")
        db_file.unlink()
    else:
        print(f"No existing database found at {DB_PATH}")

def create_tables(conn):
    """Create all table schemas"""
    cursor = conn.cursor()
    for table_name, config in TABLES.items():
        print(f"Creating table: {table_name}")
        cursor.execute(config['schema'])
    conn.commit()

def import_csv(conn, table_name, csv_path):
    """Import CSV file into table"""
    cursor = conn.cursor()

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)  # Skip header row

        # Build INSERT statement
        placeholders = ','.join(['?' for _ in headers])
        insert_sql = f"INSERT INTO {table_name} VALUES ({placeholders})"

        # Import rows
        rows_imported = 0
        for row in reader:
            # Convert empty strings to None for proper NULL handling
            row = [None if cell == '' else cell for cell in row]
            cursor.execute(insert_sql, row)
            rows_imported += 1

        conn.commit()
        print(f"  Imported {rows_imported} rows from {csv_path}")

def create_indexes(conn):
    """Create indexes for faster queries"""
    cursor = conn.cursor()

    print("\nCreating indexes...")

    # FusionAll table - index on input elements and output element
    cursor.execute("CREATE INDEX idx_fusionall_e1 ON FusionAll(E1)")
    cursor.execute("CREATE INDEX idx_fusionall_e2 ON FusionAll(E2)")
    cursor.execute("CREATE INDEX idx_fusionall_e ON FusionAll(E)")
    cursor.execute("CREATE INDEX idx_fusionall_neutrino ON FusionAll(neutrino)")

    # FissionAll table - index on input element and output elements
    cursor.execute("CREATE INDEX idx_fissionall_e ON FissionAll(E)")
    cursor.execute("CREATE INDEX idx_fissionall_e1 ON FissionAll(E1)")
    cursor.execute("CREATE INDEX idx_fissionall_e2 ON FissionAll(E2)")
    cursor.execute("CREATE INDEX idx_fissionall_neutrino ON FissionAll(neutrino)")

    # TwoToTwoAll table - index on all elements
    cursor.execute("CREATE INDEX idx_twotwoall_e1 ON TwoToTwoAll(E1)")
    cursor.execute("CREATE INDEX idx_twotwoall_e2 ON TwoToTwoAll(E2)")
    cursor.execute("CREATE INDEX idx_twotwoall_e3 ON TwoToTwoAll(E3)")
    cursor.execute("CREATE INDEX idx_twotwoall_e4 ON TwoToTwoAll(E4)")
    cursor.execute("CREATE INDEX idx_twotwoall_neutrino ON TwoToTwoAll(neutrino)")

    # NuclidesPlus - index on element symbol
    cursor.execute("CREATE INDEX idx_nuclidesplus_e ON NuclidesPlus(E)")

    # ElementPropertiesPlus - already has primary key on Z
    cursor.execute("CREATE INDEX idx_elementpropertiesplus_e ON ElementPropertiesPlus(E)")

    conn.commit()
    print("  Indexes created")

def create_elements_plus_view(conn):
    """Create ElementsPlus view from ElementPropertiesPlus"""
    cursor = conn.cursor()

    print("\nCreating ElementsPlus view...")
    cursor.execute('''
        CREATE VIEW ElementsPlus AS
        SELECT Z, E, EName
        FROM ElementPropertiesPlus
    ''')
    conn.commit()
    print("  ElementsPlus view created")

def verify_database(conn):
    """Verify row counts in database"""
    cursor = conn.cursor()

    print("\n=== Database Verification ===")
    for table_name in TABLES.keys():
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"{table_name}: {count:,} rows")

def main():
    print("=== Rebuilding Parkhomov Database ===\n")

    # Step 1: Delete existing database
    delete_database()

    # Step 2: Create new database
    print(f"\nCreating new database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)

    # Step 3: Create tables
    print("\n=== Creating Tables ===")
    create_tables(conn)

    # Step 4: Import CSV data
    print("\n=== Importing CSV Data ===")
    for table_name, config in TABLES.items():
        csv_path = config['csv']
        print(f"\nImporting {table_name}...")
        import_csv(conn, table_name, csv_path)

    # Step 5: Create indexes
    create_indexes(conn)

    # Step 6: Create ElementsPlus view
    create_elements_plus_view(conn)

    # Step 7: Verify
    verify_database(conn)

    conn.close()
    print("\n✅ Database rebuild complete!")

if __name__ == '__main__':
    main()
