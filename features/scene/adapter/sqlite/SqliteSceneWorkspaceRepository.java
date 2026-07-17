package features.scene.adapter.sqlite;

import features.scene.application.SceneWorkspaceRepository;
import features.scene.domain.RunningScene;
import features.scene.domain.SceneMob;
import features.scene.domain.SceneParticipantKind;
import features.scene.domain.SceneParticipantState;
import features.scene.domain.SceneWorkspace;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

public final class SqliteSceneWorkspaceRepository implements SceneWorkspaceRepository {

    private static final String OWNER = "scene";
    private static final String WORKSPACE_TABLE = "scene_workspace";
    private static final String SCENE_TABLE = "scene_running_scene";
    private static final String PC_TABLE = "scene_party_member";
    private static final String NPC_TABLE = "scene_npc";
    private static final String MOB_TABLE = "scene_mob";
    private static final String STATE_TABLE = "scene_participant_state";

    private final SqliteConnectionSource connections;

    public SqliteSceneWorkspaceRepository(SqliteDatabase database) {
        connections = Objects.requireNonNull(database, "database")
                .connections(
                        OWNER,
                        new SqliteMigration(1, SqliteSceneWorkspaceRepository::createSchema),
                        new SqliteMigration(2, SqliteSceneWorkspaceRepository::createMobSchema),
                        new SqliteMigration(3, SqliteSceneWorkspaceRepository::createParticipantStateSchema));
    }

    @Override
    public Optional<SceneWorkspace> load() {
        try (Connection connection = connections.openConnection()) {
            WorkspaceRecord workspace = loadWorkspace(connection);
            if (workspace == null) {
                return Optional.empty();
            }
            Map<Long, StoredScene> scenes = loadScenes(connection);
            loadAssignments(connection, PC_TABLE, scenes, true);
            loadAssignments(connection, NPC_TABLE, scenes, false);
            loadMobs(connection, scenes);
            loadParticipantStates(connection, scenes);
            List<RunningScene> runningScenes = scenes.values().stream().map(StoredScene::toDomain).toList();
            return Optional.of(workspace.toDomain(runningScenes));
        } catch (SQLException | IllegalArgumentException exception) {
            throw new IllegalStateException("Scene workspace could not be loaded", exception);
        }
    }

    @Override
    public void save(SceneWorkspace workspace) {
        SceneWorkspace safeWorkspace = Objects.requireNonNull(workspace, "workspace");
        try (Connection connection = connections.openConnection()) {
            boolean autoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                writeWorkspace(connection, safeWorkspace);
                replaceScenes(connection, safeWorkspace.scenes());
                connection.commit();
            } catch (SQLException | RuntimeException exception) {
                rollback(connection, exception);
                throw exception;
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException | RuntimeException exception) {
            throw new IllegalStateException("Scene workspace could not be saved", exception);
        }
    }

    private static void createSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS " + WORKSPACE_TABLE + " ("
                    + "workspace_id INTEGER PRIMARY KEY CHECK(workspace_id=1), "
                    + "revision INTEGER NOT NULL CHECK(revision>0), "
                    + "next_scene_id INTEGER NOT NULL CHECK(next_scene_id>1), "
                    + "default_scene_id INTEGER NOT NULL CHECK(default_scene_id>0), "
                    + "focused_scene_id INTEGER NOT NULL CHECK(focused_scene_id>0), "
                    + "encounter_synchronized INTEGER NOT NULL CHECK(encounter_synchronized IN (0,1)), "
                    + "status_text TEXT NOT NULL)");
            statement.execute("CREATE TABLE IF NOT EXISTS " + SCENE_TABLE + " ("
                    + "scene_id INTEGER PRIMARY KEY CHECK(scene_id>0), "
                    + "title TEXT NOT NULL, notes TEXT NOT NULL, "
                    + "source_session_id INTEGER NOT NULL CHECK(source_session_id>=0), "
                    + "source_scene_id INTEGER NOT NULL CHECK(source_scene_id>=0), "
                    + "source_session_name TEXT NOT NULL, "
                    + "initial_encounter_plan_id INTEGER NOT NULL CHECK(initial_encounter_plan_id>=0), "
                    + "location_external_id INTEGER NOT NULL CHECK(location_external_id>=0), "
                    + "sort_order INTEGER NOT NULL CHECK(sort_order>=0))");
            statement.execute(assignmentTableSql(PC_TABLE, "party_member_external_id"));
            statement.execute(assignmentTableSql(NPC_TABLE, "npc_external_id"));
        }
    }

    private static void createMobSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS " + MOB_TABLE + " ("
                    + "scene_id INTEGER NOT NULL, "
                    + "creature_external_id INTEGER NOT NULL CHECK(creature_external_id>0), "
                    + "count INTEGER NOT NULL CHECK(count>0), "
                    + "sort_order INTEGER NOT NULL CHECK(sort_order>=0), "
                    + "PRIMARY KEY(scene_id,creature_external_id), "
                    + "FOREIGN KEY(scene_id) REFERENCES " + SCENE_TABLE + "(scene_id) ON DELETE CASCADE)");
        }
    }

    private static void createParticipantStateSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS " + STATE_TABLE + " ("
                    + "scene_id INTEGER NOT NULL, "
                    + "participant_kind TEXT NOT NULL CHECK(participant_kind IN ('PC','NPC','MOB')), "
                    + "participant_ref_id INTEGER NOT NULL CHECK(participant_ref_id>0), "
                    + "defeated INTEGER NOT NULL CHECK(defeated IN (0,1)), "
                    + "notes TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL CHECK(sort_order>=0), "
                    + "PRIMARY KEY(scene_id,participant_kind,participant_ref_id), "
                    + "FOREIGN KEY(scene_id) REFERENCES " + SCENE_TABLE + "(scene_id) ON DELETE CASCADE)");
        }
    }

    private static String assignmentTableSql(String table, String externalIdColumn) {
        return "CREATE TABLE IF NOT EXISTS " + table + " ("
                + "scene_id INTEGER NOT NULL, "
                + externalIdColumn + " INTEGER NOT NULL CHECK(" + externalIdColumn + ">0), "
                + "sort_order INTEGER NOT NULL CHECK(sort_order>=0), "
                + "PRIMARY KEY(scene_id," + externalIdColumn + "), "
                + "UNIQUE(" + externalIdColumn + "), "
                + "FOREIGN KEY(scene_id) REFERENCES " + SCENE_TABLE + "(scene_id) ON DELETE CASCADE)";
    }

    private static WorkspaceRecord loadWorkspace(Connection connection) throws SQLException {
        String sql = "SELECT revision,next_scene_id,default_scene_id,focused_scene_id,"
                + "encounter_synchronized,status_text FROM " + WORKSPACE_TABLE + " WHERE workspace_id=1";
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            return rows.next()
                    ? new WorkspaceRecord(
                            rows.getLong("revision"),
                            rows.getLong("next_scene_id"),
                            rows.getLong("default_scene_id"),
                            rows.getLong("focused_scene_id"),
                            rows.getInt("encounter_synchronized") == 1,
                            rows.getString("status_text"))
                    : null;
        }
    }

    private static Map<Long, StoredScene> loadScenes(Connection connection) throws SQLException {
        Map<Long, StoredScene> scenes = new LinkedHashMap<>();
        String sql = "SELECT scene_id,title,notes,source_session_id,source_scene_id,source_session_name,"
                + "initial_encounter_plan_id,location_external_id FROM " + SCENE_TABLE + " ORDER BY sort_order";
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            while (rows.next()) {
                StoredScene scene = new StoredScene(
                        rows.getLong("scene_id"),
                        rows.getString("title"),
                        rows.getString("notes"),
                        rows.getLong("source_session_id"),
                        rows.getLong("source_scene_id"),
                        rows.getString("source_session_name"),
                        rows.getLong("initial_encounter_plan_id"),
                        rows.getLong("location_external_id"));
                scenes.put(scene.sceneId, scene);
            }
        }
        return scenes;
    }

    private static void loadAssignments(
            Connection connection,
            String table,
            Map<Long, StoredScene> scenes,
            boolean partyMembers
    ) throws SQLException {
        String idColumn = partyMembers ? "party_member_external_id" : "npc_external_id";
        String sql = "SELECT scene_id," + idColumn + " FROM " + table + " ORDER BY scene_id,sort_order";
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            while (rows.next()) {
                StoredScene scene = scenes.get(rows.getLong("scene_id"));
                if (scene == null) {
                    throw new SQLException("Scene assignment references a missing owned scene");
                }
                if (partyMembers) {
                    scene.partyMemberIds.add(rows.getLong(idColumn));
                } else {
                    scene.npcIds.add(rows.getLong(idColumn));
                }
            }
        }
    }

    private static void loadMobs(Connection connection, Map<Long, StoredScene> scenes) throws SQLException {
        String sql = "SELECT scene_id,creature_external_id,count FROM " + MOB_TABLE + " ORDER BY scene_id,sort_order";
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            while (rows.next()) {
                StoredScene scene = scenes.get(rows.getLong("scene_id"));
                if (scene == null) {
                    throw new SQLException("Scene mob references a missing owned scene");
                }
                scene.mobs.add(new SceneMob(rows.getLong("creature_external_id"), rows.getInt("count")));
            }
        }
    }

    private static void loadParticipantStates(
            Connection connection, Map<Long, StoredScene> scenes) throws SQLException {
        String sql = "SELECT scene_id,participant_kind,participant_ref_id,defeated,notes FROM " + STATE_TABLE
                + " ORDER BY scene_id,sort_order";
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            while (rows.next()) {
                StoredScene scene = scenes.get(rows.getLong("scene_id"));
                if (scene == null) {
                    throw new SQLException("Scene participant state references a missing owned scene");
                }
                scene.participantStates.add(new SceneParticipantState(
                        SceneParticipantKind.valueOf(rows.getString("participant_kind")),
                        rows.getLong("participant_ref_id"),
                        rows.getInt("defeated") == 1,
                        rows.getString("notes")));
            }
        }
    }

    private static void writeWorkspace(Connection connection, SceneWorkspace workspace) throws SQLException {
        String sql = "INSERT INTO " + WORKSPACE_TABLE
                + "(workspace_id,revision,next_scene_id,default_scene_id,focused_scene_id,"
                + "encounter_synchronized,status_text) VALUES(1,?,?,?,?,?,?) "
                + "ON CONFLICT(workspace_id) DO UPDATE SET revision=excluded.revision,"
                + "next_scene_id=excluded.next_scene_id,default_scene_id=excluded.default_scene_id,"
                + "focused_scene_id=excluded.focused_scene_id,"
                + "encounter_synchronized=excluded.encounter_synchronized,status_text=excluded.status_text";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, workspace.revision());
            statement.setLong(2, workspace.nextSceneId());
            statement.setLong(3, workspace.defaultSceneId());
            statement.setLong(4, workspace.focusedSceneId());
            statement.setInt(5, workspace.encounterSynchronized() ? 1 : 0);
            statement.setString(6, workspace.statusText());
            statement.executeUpdate();
        }
    }

    private static void replaceScenes(Connection connection, List<RunningScene> scenes) throws SQLException {
        deleteAll(connection, PC_TABLE);
        deleteAll(connection, NPC_TABLE);
        deleteAll(connection, MOB_TABLE);
        deleteAll(connection, STATE_TABLE);
        deleteAll(connection, SCENE_TABLE);
        for (int index = 0; index < scenes.size(); index++) {
            RunningScene scene = scenes.get(index);
            insertScene(connection, scene, index);
            insertAssignments(connection, PC_TABLE, "party_member_external_id", scene.sceneId(), scene.partyMemberIds());
            insertAssignments(connection, NPC_TABLE, "npc_external_id", scene.sceneId(), scene.npcIds());
            insertMobs(connection, scene.sceneId(), scene.mobs());
            insertParticipantStates(connection, scene.sceneId(), scene.participantStates());
        }
    }

    private static void deleteAll(Connection connection, String table) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM " + table);
        }
    }

    private static void insertScene(Connection connection, RunningScene scene, int order) throws SQLException {
        String sql = "INSERT INTO " + SCENE_TABLE
                + "(scene_id,title,notes,source_session_id,source_scene_id,source_session_name,"
                + "initial_encounter_plan_id,location_external_id,sort_order) VALUES(?,?,?,?,?,?,?,?,?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, scene.sceneId());
            statement.setString(2, scene.title());
            statement.setString(3, scene.notes());
            statement.setLong(4, scene.sourceSessionId());
            statement.setLong(5, scene.sourceSceneId());
            statement.setString(6, scene.sourceSessionName());
            statement.setLong(7, scene.initialEncounterPlanId());
            statement.setLong(8, scene.locationId());
            statement.setInt(9, order);
            statement.executeUpdate();
        }
    }

    private static void insertAssignments(
            Connection connection,
            String table,
            String idColumn,
            long sceneId,
            List<Long> ids
    ) throws SQLException {
        String sql = "INSERT INTO " + table + "(scene_id," + idColumn + ",sort_order) VALUES(?,?,?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < ids.size(); index++) {
                statement.setLong(1, sceneId);
                statement.setLong(2, ids.get(index));
                statement.setInt(3, index);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertMobs(Connection connection, long sceneId, List<SceneMob> mobs) throws SQLException {
        String sql = "INSERT INTO " + MOB_TABLE + "(scene_id,creature_external_id,count,sort_order) VALUES(?,?,?,?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < mobs.size(); index++) {
                SceneMob mob = mobs.get(index);
                statement.setLong(1, sceneId);
                statement.setLong(2, mob.creatureId());
                statement.setInt(3, mob.count());
                statement.setInt(4, index);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertParticipantStates(
            Connection connection, long sceneId, List<SceneParticipantState> states) throws SQLException {
        String sql = "INSERT INTO " + STATE_TABLE
                + "(scene_id,participant_kind,participant_ref_id,defeated,notes,sort_order) VALUES(?,?,?,?,?,?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < states.size(); index++) {
                SceneParticipantState state = states.get(index);
                statement.setLong(1, sceneId);
                statement.setString(2, state.kind().name());
                statement.setLong(3, state.refId());
                statement.setInt(4, state.defeated() ? 1 : 0);
                statement.setString(5, state.notes());
                statement.setInt(6, index);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void rollback(Connection connection, Exception original) {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            original.addSuppressed(rollbackFailure);
        }
    }

    private record WorkspaceRecord(
            long revision,
            long nextSceneId,
            long defaultSceneId,
            long focusedSceneId,
            boolean encounterSynchronized,
            String statusText
    ) {
        private SceneWorkspace toDomain(List<RunningScene> scenes) {
            return new SceneWorkspace(revision, nextSceneId, defaultSceneId, focusedSceneId,
                    encounterSynchronized, statusText, scenes);
        }
    }

    private static final class StoredScene {
        private final long sceneId;
        private final String title;
        private final String notes;
        private final long sourceSessionId;
        private final long sourceSceneId;
        private final String sourceSessionName;
        private final long initialEncounterPlanId;
        private final long locationId;
        private final List<Long> partyMemberIds = new ArrayList<>();
        private final List<Long> npcIds = new ArrayList<>();
        private final List<SceneMob> mobs = new ArrayList<>();
        private final List<SceneParticipantState> participantStates = new ArrayList<>();

        private StoredScene(
                long sceneId,
                String title,
                String notes,
                long sourceSessionId,
                long sourceSceneId,
                String sourceSessionName,
                long initialEncounterPlanId,
                long locationId
        ) {
            this.sceneId = sceneId;
            this.title = title;
            this.notes = notes;
            this.sourceSessionId = sourceSessionId;
            this.sourceSceneId = sourceSceneId;
            this.sourceSessionName = sourceSessionName;
            this.initialEncounterPlanId = initialEncounterPlanId;
            this.locationId = locationId;
        }

        private RunningScene toDomain() {
            return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                    sourceSessionName, initialEncounterPlanId, locationId,
                    partyMemberIds, npcIds, mobs, participantStates);
        }
    }
}
