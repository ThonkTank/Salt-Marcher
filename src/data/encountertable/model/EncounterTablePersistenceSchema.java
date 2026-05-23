package src.data.encountertable.model;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

public final class EncounterTablePersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";
    public static final String REFERENCED_CREATURES_TABLE_NAME = "creatures";
    public static final String ENCOUNTER_TABLES_TABLE = "encounter_tables";
    public static final String ENCOUNTER_TABLE_ENTRIES_TABLE = "encounter_table_entries";
    public static final String ENCOUNTER_TABLE_LOOT_LINKS_TABLE = "encounter_table_loot_links";

    public static final SqliteTableSpec ENCOUNTER_TABLES = table(
            ENCOUNTER_TABLES_TABLE,
            column("table_id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            column("name", "TEXT NOT NULL"),
            column("description", "TEXT"));

    public static final SqliteTableSpec ENCOUNTER_TABLE_ENTRIES = table(
            ENCOUNTER_TABLE_ENTRIES_TABLE,
            column("table_id", "INTEGER NOT NULL REFERENCES encounter_tables(table_id) ON DELETE CASCADE"),
            column("creature_id", "INTEGER NOT NULL REFERENCES " + REFERENCED_CREATURES_TABLE_NAME
                    + "(id) ON DELETE CASCADE"),
            column("weight", "INTEGER NOT NULL DEFAULT 1 CHECK(weight BETWEEN 1 AND 10)"));

    public static final SqliteTableSpec ENCOUNTER_TABLE_LOOT_LINKS = table(
            ENCOUNTER_TABLE_LOOT_LINKS_TABLE,
            column("table_id", "INTEGER PRIMARY KEY REFERENCES encounter_tables(table_id) ON DELETE CASCADE"),
            column("loot_table_id", "INTEGER NOT NULL REFERENCES loot_tables(loot_table_id) ON DELETE CASCADE"));

    public static final String CREATE_ENCOUNTER_TABLES_SQL = ENCOUNTER_TABLES.createTableSql();

    public static final String CREATE_ENCOUNTER_TABLE_ENTRIES_SQL =
            "CREATE TABLE IF NOT EXISTS " + ENCOUNTER_TABLE_ENTRIES.name() + " ("
                    + "table_id INTEGER NOT NULL REFERENCES " + ENCOUNTER_TABLES.name()
                    + "(table_id) ON DELETE CASCADE, "
                    + "creature_id INTEGER NOT NULL REFERENCES " + REFERENCED_CREATURES_TABLE_NAME
                    + "(id) ON DELETE CASCADE, "
                    + "weight INTEGER NOT NULL DEFAULT 1 CHECK(weight BETWEEN 1 AND 10), "
                    + "PRIMARY KEY(table_id, creature_id)"
                    + ")";

    public static final String CREATE_ENCOUNTER_TABLE_LOOT_LINKS_SQL =
            "CREATE TABLE IF NOT EXISTS " + ENCOUNTER_TABLE_LOOT_LINKS.name() + " ("
                    + "table_id INTEGER PRIMARY KEY REFERENCES " + ENCOUNTER_TABLES.name()
                    + "(table_id) ON DELETE CASCADE, "
                    + "loot_table_id INTEGER NOT NULL REFERENCES loot_tables(loot_table_id) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_ENCOUNTER_TABLE_ENTRIES_TABLE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_encounter_table_entries_table ON "
                    + ENCOUNTER_TABLE_ENTRIES.name() + "(table_id)";

    public static final String CREATE_ENCOUNTER_TABLE_ENTRIES_CREATURE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_encounter_table_entries_creature ON "
                    + ENCOUNTER_TABLE_ENTRIES.name() + "(creature_id)";

    private EncounterTablePersistenceSchema() {
    }
}
