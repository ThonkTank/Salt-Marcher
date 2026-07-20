package features.worldplanner.adapter.sqlite.model;

public final class WorldPlannerPersistenceSchema {

    private static final String DATABASE_FILE_NAME = "game.db";
    public static final String NPCS_TABLE = "world_planner_npcs";
    public static final String FACTIONS_TABLE = "world_planner_factions";
    public static final String FACTION_NPCS_TABLE = "world_planner_faction_npcs";
    public static final String FACTION_LIMITS_TABLE = "world_planner_faction_inventory_limits";
    public static final String LOCATIONS_TABLE = "world_planner_locations";
    public static final String LOCATION_FACTIONS_TABLE = "world_planner_location_factions";
    public static final String LOCATION_TABLES_TABLE = "world_planner_location_encounter_tables";
    public static final String NPC_DISPOSITION_COLUMN = "disposition_modifier";
    public static final String FACTION_DISPOSITION_COLUMN = "disposition";
    private static final String CREATE_TABLE_IF_NOT_EXISTS = "CREATE TABLE IF NOT EXISTS ";

    public static final String CREATE_NPCS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + NPCS_TABLE + " ("
                    + "npc_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, "
                    + "creature_statblock_id INTEGER NOT NULL, "
                    + "appearance_notes TEXT NOT NULL, "
                    + "behavior_notes TEXT NOT NULL, "
                    + "history_notes TEXT NOT NULL, "
                    + "general_notes TEXT NOT NULL, "
                    + NPC_DISPOSITION_COLUMN + " INTEGER NOT NULL DEFAULT 0 CHECK("
                    + NPC_DISPOSITION_COLUMN + " BETWEEN -50 AND 50), "
                    + "status TEXT NOT NULL"
                    + ")";

    public static final String CREATE_FACTIONS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + FACTIONS_TABLE + " ("
                    + "faction_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, "
                    + "notes TEXT NOT NULL, "
                    + FACTION_DISPOSITION_COLUMN + " INTEGER NOT NULL DEFAULT 0 CHECK("
                    + FACTION_DISPOSITION_COLUMN + " BETWEEN -50 AND 50), "
                    + "primary_encounter_table_id INTEGER NOT NULL"
                    + ")";

    public static final String CREATE_FACTION_NPCS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + FACTION_NPCS_TABLE + " ("
                    + "faction_id INTEGER NOT NULL REFERENCES " + FACTIONS_TABLE + "(faction_id) ON DELETE CASCADE, "
                    + "npc_id INTEGER NOT NULL REFERENCES " + NPCS_TABLE + "(npc_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(faction_id, npc_id)"
                    + ")";

    public static final String CREATE_FACTION_NPC_UNIQUE_INDEX_SQL =
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_world_planner_npc_single_faction ON "
                    + FACTION_NPCS_TABLE + "(npc_id)";

    public static final String KEEP_ONE_FACTION_PER_NPC_SQL =
            "DELETE FROM " + FACTION_NPCS_TABLE + " "
                    + "WHERE EXISTS (SELECT 1 FROM " + FACTION_NPCS_TABLE + " AS earlier "
                    + "WHERE earlier.npc_id = " + FACTION_NPCS_TABLE + ".npc_id "
                    + "AND earlier.faction_id < " + FACTION_NPCS_TABLE + ".faction_id)";

    public static final String CREATE_FACTION_LIMITS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + FACTION_LIMITS_TABLE + " ("
                    + "faction_id INTEGER NOT NULL REFERENCES " + FACTIONS_TABLE + "(faction_id) ON DELETE CASCADE, "
                    + "creature_statblock_id INTEGER NOT NULL, "
                    + "finite INTEGER NOT NULL CHECK(finite IN (0, 1)), "
                    + "quantity INTEGER NOT NULL, "
                    + "PRIMARY KEY(faction_id, creature_statblock_id)"
                    + ")";

    public static final String CREATE_LOCATIONS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + LOCATIONS_TABLE + " ("
                    + "location_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, "
                    + "notes TEXT NOT NULL"
                    + ")";

    public static final String CREATE_LOCATION_FACTIONS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + LOCATION_FACTIONS_TABLE + " ("
                    + "location_id INTEGER NOT NULL REFERENCES " + LOCATIONS_TABLE + "(location_id) ON DELETE CASCADE, "
                    + "faction_id INTEGER NOT NULL REFERENCES " + FACTIONS_TABLE + "(faction_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(location_id, faction_id)"
                    + ")";

    public static final String CREATE_LOCATION_TABLES_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + LOCATION_TABLES_TABLE + " ("
                    + "location_id INTEGER NOT NULL REFERENCES " + LOCATIONS_TABLE + "(location_id) ON DELETE CASCADE, "
                    + "encounter_table_id INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(location_id, encounter_table_id)"
                    + ")";

    public static String databaseFileName() {
        return DATABASE_FILE_NAME;
    }

    private WorldPlannerPersistenceSchema() {
    }
}
