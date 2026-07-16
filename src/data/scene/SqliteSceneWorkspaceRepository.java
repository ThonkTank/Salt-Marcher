package src.data.scene;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;
import src.domain.scene.model.RunningScene;
import src.domain.scene.model.SceneWorkspace;
import src.domain.scene.model.repository.SceneWorkspaceRepository;

public final class SqliteSceneWorkspaceRepository implements SceneWorkspaceRepository {
    private static final String SCENES = "runtime_scenes";
    private static final String WORKSPACE = "runtime_scene_workspace";
    private static final String PARTY = "runtime_scene_party_members";
    private static final String NPCS = "runtime_scene_npcs";
    private final ConnectionFactory connections = new ConnectionFactory();

    @Override
    public Optional<SceneWorkspace> load() {
        try (Connection connection = readyConnection()) {
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT revision, next_scene_id, default_scene_id, focused_scene_id, status_text FROM " + WORKSPACE
                            + " WHERE singleton_id = 1");
                    ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    return Optional.empty();
                }
                return Optional.of(new SceneWorkspace(
                        result.getLong("revision"), result.getLong("next_scene_id"),
                        result.getLong("default_scene_id"), result.getLong("focused_scene_id"),
                        loadScenes(connection), result.getString("status_text")));
            }
        } catch (SQLException | IllegalArgumentException exception) {
            throw new IllegalStateException("Failed to load runtime scenes from SQLite.", exception);
        }
    }

    @Override
    public SceneWorkspace save(SceneWorkspace workspace) {
        if (workspace == null) {
            throw new IllegalArgumentException("workspace must be present");
        }
        try (Connection connection = readyConnection()) {
            boolean autoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                clear(connection);
                saveScenes(connection, workspace.scenes());
                try (PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO " + WORKSPACE
                                + " (singleton_id, revision, next_scene_id, default_scene_id, focused_scene_id, status_text)"
                                + " VALUES (1, ?, ?, ?, ?, ?)")) {
                    statement.setLong(1, workspace.revision());
                    statement.setLong(2, workspace.nextSceneId());
                    statement.setLong(3, workspace.defaultSceneId());
                    statement.setLong(4, workspace.focusedSceneId());
                    statement.setString(5, workspace.statusText());
                    statement.executeUpdate();
                }
                connection.commit();
                return workspace;
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save runtime scenes to SQLite.", exception);
        }
    }

    private Connection readyConnection() throws SQLException {
        Connection connection = connections.openConnection();
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("CREATE TABLE IF NOT EXISTS " + SCENES + " ("
                    + "scene_id INTEGER PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL, "
                    + "source_session_id INTEGER NOT NULL DEFAULT 0, source_scene_id INTEGER NOT NULL DEFAULT 0, "
                    + "source_encounter_plan_id INTEGER NOT NULL DEFAULT 0, location_id INTEGER NOT NULL DEFAULT 0, "
                    + "sort_order INTEGER NOT NULL)");
            statement.execute("CREATE TABLE IF NOT EXISTS " + WORKSPACE + " ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1), revision INTEGER NOT NULL, "
                    + "next_scene_id INTEGER NOT NULL, default_scene_id INTEGER NOT NULL REFERENCES " + SCENES + "(scene_id), "
                    + "focused_scene_id INTEGER NOT NULL REFERENCES " + SCENES + "(scene_id), status_text TEXT NOT NULL)");
            statement.execute("CREATE TABLE IF NOT EXISTS " + PARTY + " ("
                    + "scene_id INTEGER NOT NULL REFERENCES " + SCENES + "(scene_id) ON DELETE CASCADE, "
                    + "character_id INTEGER NOT NULL UNIQUE, sort_order INTEGER NOT NULL, PRIMARY KEY(scene_id, character_id))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + NPCS + " ("
                    + "scene_id INTEGER NOT NULL REFERENCES " + SCENES + "(scene_id) ON DELETE CASCADE, "
                    + "npc_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(scene_id, npc_id))");
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
        return connection;
    }

    private static List<RunningScene> loadScenes(Connection connection) throws SQLException {
        List<RunningScene> scenes = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT scene_id, title, notes, source_session_id, source_scene_id, source_encounter_plan_id, location_id"
                        + " FROM " + SCENES + " ORDER BY sort_order");
                ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                long id = result.getLong("scene_id");
                scenes.add(new RunningScene(id, result.getString("title"), result.getString("notes"),
                        result.getLong("source_session_id"), result.getLong("source_scene_id"),
                        result.getLong("source_encounter_plan_id"), result.getLong("location_id"),
                        loadIds(connection, PARTY, "character_id", id), loadIds(connection, NPCS, "npc_id", id)));
            }
        }
        return List.copyOf(scenes);
    }

    private static List<Long> loadIds(Connection connection, String table, String column, long sceneId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT " + column + " FROM " + table + " WHERE scene_id = ? ORDER BY sort_order")) {
            statement.setLong(1, sceneId);
            try (ResultSet result = statement.executeQuery()) {
                List<Long> ids = new ArrayList<>();
                while (result.next()) {
                    ids.add(result.getLong(column));
                }
                return List.copyOf(ids);
            }
        }
    }

    private static void clear(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM " + WORKSPACE);
            statement.executeUpdate("DELETE FROM " + PARTY);
            statement.executeUpdate("DELETE FROM " + NPCS);
            statement.executeUpdate("DELETE FROM " + SCENES);
        }
    }

    private static void saveScenes(Connection connection, List<RunningScene> scenes) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO " + SCENES
                        + " (scene_id, title, notes, source_session_id, source_scene_id, source_encounter_plan_id, location_id, sort_order)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            for (int index = 0; index < scenes.size(); index++) {
                RunningScene scene = scenes.get(index);
                statement.setLong(1, scene.sceneId()); statement.setString(2, scene.title());
                statement.setString(3, scene.notes()); statement.setLong(4, scene.sourceSessionId());
                statement.setLong(5, scene.sourceSceneId()); statement.setLong(6, scene.sourceEncounterPlanId());
                statement.setLong(7, scene.locationId()); statement.setInt(8, index); statement.addBatch();
            }
            statement.executeBatch();
        }
        for (RunningScene scene : scenes) {
            saveIds(connection, PARTY, "character_id", scene.sceneId(), scene.partyMemberIds());
            saveIds(connection, NPCS, "npc_id", scene.sceneId(), scene.npcIds());
        }
    }

    private static void saveIds(Connection connection, String table, String column, long sceneId, List<Long> ids)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO " + table + " (scene_id, " + column + ", sort_order) VALUES (?, ?, ?)")) {
            for (int index = 0; index < ids.size(); index++) {
                statement.setLong(1, sceneId); statement.setLong(2, ids.get(index));
                statement.setInt(3, index); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static final class ConnectionFactory extends AbstractSqliteConnectionFactory {
        private ConnectionFactory() { super(resolveDatabasePath("game.db")); }
    }
}
