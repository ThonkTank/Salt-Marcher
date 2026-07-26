package features.scene.adapter.sqlite;

import java.util.List;

/** Canonical DDL for the only supported Scene persistence schema. */
final class ScenePersistenceSchema {

    static final String WORKSPACE_TABLE = "scene_workspace";
    static final String SCENE_TABLE = "scene_running_scene";
    static final String PC_TABLE = "scene_party_member";
    static final String NPC_TABLE = "scene_npc";
    static final String MOB_TABLE = "scene_mob";
    static final String STATE_TABLE = "scene_participant_state";

    static final List<String> CREATE_TABLE_SQL = List.of(
            "CREATE TABLE " + WORKSPACE_TABLE + " (workspace_id INTEGER PRIMARY KEY"
                    + " CHECK(workspace_id=1), revision INTEGER NOT NULL CHECK(revision>0),"
                    + " next_scene_id INTEGER NOT NULL CHECK(next_scene_id>1), default_scene_id"
                    + " INTEGER NOT NULL CHECK(default_scene_id>0), focused_scene_id INTEGER NOT"
                    + " NULL CHECK(focused_scene_id>0), encounter_synchronized INTEGER NOT NULL"
                    + " CHECK(encounter_synchronized IN (0,1)), status_text TEXT NOT NULL)",
            "CREATE TABLE " + SCENE_TABLE + " (scene_id INTEGER PRIMARY KEY CHECK(scene_id>0),"
                    + " title TEXT NOT NULL, notes TEXT NOT NULL, source_session_id INTEGER NOT NULL"
                    + " CHECK(source_session_id>=0), source_scene_id INTEGER NOT NULL"
                    + " CHECK(source_scene_id>=0), source_session_name TEXT NOT NULL,"
                    + " initial_encounter_plan_id INTEGER NOT NULL CHECK(initial_encounter_plan_id>=0),"
                    + " location_external_id INTEGER NOT NULL CHECK(location_external_id>=0),"
                    + " sort_order INTEGER NOT NULL CHECK(sort_order>=0))",
            assignmentTableSql(PC_TABLE, "party_member_external_id"),
            assignmentTableSql(NPC_TABLE, "npc_external_id"),
            "CREATE TABLE " + MOB_TABLE + " (scene_id INTEGER NOT NULL, creature_external_id"
                    + " INTEGER NOT NULL CHECK(creature_external_id>0), count INTEGER NOT NULL"
                    + " CHECK(count>0), sort_order INTEGER NOT NULL CHECK(sort_order>=0), PRIMARY"
                    + " KEY(scene_id,creature_external_id), FOREIGN KEY(scene_id) REFERENCES "
                    + SCENE_TABLE + "(scene_id) ON DELETE CASCADE)",
            "CREATE TABLE " + STATE_TABLE + " (scene_id INTEGER NOT NULL, participant_kind TEXT"
                    + " NOT NULL CHECK(participant_kind IN ('PC','NPC','MOB')), participant_ref_id"
                    + " INTEGER NOT NULL CHECK(participant_ref_id>0), defeated INTEGER NOT NULL"
                    + " CHECK(defeated IN (0,1)), notes TEXT NOT NULL, sort_order INTEGER NOT NULL"
                    + " CHECK(sort_order>=0), PRIMARY KEY(scene_id,participant_kind,participant_ref_id),"
                    + " FOREIGN KEY(scene_id) REFERENCES " + SCENE_TABLE
                    + "(scene_id) ON DELETE CASCADE)");

    static final List<String> CREATE_INDEX_SQL = List.of();

    private ScenePersistenceSchema() {
    }

    private static String assignmentTableSql(String table, String externalIdColumn) {
        return "CREATE TABLE " + table + " (scene_id INTEGER NOT NULL, "
                + externalIdColumn + " INTEGER NOT NULL CHECK(" + externalIdColumn + ">0), "
                + "sort_order INTEGER NOT NULL CHECK(sort_order>=0), "
                + "PRIMARY KEY(scene_id," + externalIdColumn + "), "
                + "UNIQUE(" + externalIdColumn + "), "
                + "FOREIGN KEY(scene_id) REFERENCES " + SCENE_TABLE + "(scene_id) ON DELETE CASCADE)";
    }
}
