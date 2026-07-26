package features.worldplanner.adapter.sqlite.model;

import java.util.List;

public final class WorldPlannerPersistenceSchema {

    public static final String NPCS_TABLE = "world_planner_npcs";
    public static final String FACTIONS_TABLE = "world_planner_factions";
    public static final String FACTION_NPCS_TABLE = "world_planner_faction_npcs";
    public static final String FACTION_LIMITS_TABLE = "world_planner_faction_inventory_limits";
    public static final String LOCATIONS_TABLE = "world_planner_locations";
    public static final String LOCATION_FACTIONS_TABLE = "world_planner_location_factions";
    public static final String LOCATION_TABLES_TABLE = "world_planner_location_encounter_tables";
    public static final String NPC_DISPOSITION_COLUMN = "disposition_modifier";
    public static final String FACTION_DISPOSITION_COLUMN = "disposition";
    private static final String CREATE_TABLE = "CREATE TABLE ";

    public static final String CREATE_NPCS_SQL =
            CREATE_TABLE + NPCS_TABLE + " ("
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
            CREATE_TABLE + FACTIONS_TABLE + " ("
                    + "faction_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, "
                    + "notes TEXT NOT NULL, "
                    + FACTION_DISPOSITION_COLUMN + " INTEGER NOT NULL DEFAULT 0 CHECK("
                    + FACTION_DISPOSITION_COLUMN + " BETWEEN -50 AND 50), "
                    + "primary_encounter_table_id INTEGER NOT NULL"
                    + ")";

    public static final String CREATE_FACTION_NPCS_SQL =
            CREATE_TABLE + FACTION_NPCS_TABLE + " ("
                    + "faction_id INTEGER NOT NULL REFERENCES " + FACTIONS_TABLE + "(faction_id) ON DELETE CASCADE, "
                    + "npc_id INTEGER NOT NULL REFERENCES " + NPCS_TABLE + "(npc_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(faction_id, npc_id)"
                    + ")";

    public static final String CREATE_FACTION_NPC_UNIQUE_INDEX_SQL =
            "CREATE UNIQUE INDEX idx_world_planner_npc_single_faction ON "
                    + FACTION_NPCS_TABLE + "(npc_id)";

    public static final String CREATE_FACTION_LIMITS_SQL =
            CREATE_TABLE + FACTION_LIMITS_TABLE + " ("
                    + "faction_id INTEGER NOT NULL REFERENCES " + FACTIONS_TABLE + "(faction_id) ON DELETE CASCADE, "
                    + "creature_statblock_id INTEGER NOT NULL, "
                    + "finite INTEGER NOT NULL CHECK(finite IN (0, 1)), "
                    + "quantity INTEGER NOT NULL, "
                    + "PRIMARY KEY(faction_id, creature_statblock_id)"
                    + ")";

    public static final String CREATE_LOCATIONS_SQL =
            CREATE_TABLE + LOCATIONS_TABLE + " ("
                    + "location_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, "
                    + "notes TEXT NOT NULL"
                    + ")";

    public static final String CREATE_LOCATION_FACTIONS_SQL =
            CREATE_TABLE + LOCATION_FACTIONS_TABLE + " ("
                    + "location_id INTEGER NOT NULL REFERENCES " + LOCATIONS_TABLE + "(location_id) ON DELETE CASCADE, "
                    + "faction_id INTEGER NOT NULL REFERENCES " + FACTIONS_TABLE + "(faction_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(location_id, faction_id)"
                    + ")";

    public static final String CREATE_LOCATION_TABLES_SQL =
            CREATE_TABLE + LOCATION_TABLES_TABLE + " ("
                    + "location_id INTEGER NOT NULL REFERENCES " + LOCATIONS_TABLE + "(location_id) ON DELETE CASCADE, "
                    + "encounter_table_id INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(location_id, encounter_table_id)"
                    + ")";

    public static final List<String> CREATE_TABLE_SQL = List.of(
            CREATE_NPCS_SQL,
            CREATE_FACTIONS_SQL,
            CREATE_FACTION_NPCS_SQL,
            CREATE_FACTION_LIMITS_SQL,
            CREATE_LOCATIONS_SQL,
            CREATE_LOCATION_FACTIONS_SQL,
            CREATE_LOCATION_TABLES_SQL);

    public static final List<String> CREATE_INDEX_SQL = List.of(
            CREATE_FACTION_NPC_UNIQUE_INDEX_SQL);

    private WorldPlannerPersistenceSchema() {
    }
}
