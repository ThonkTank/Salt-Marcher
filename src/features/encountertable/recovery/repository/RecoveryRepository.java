package features.encountertable.recovery.repository;

import features.encountertable.recovery.model.EntrySnapshot;
import features.encountertable.recovery.model.RecoveryRestoreResult;
import features.encountertable.recovery.model.TableSnapshot;
import features.encountertable.recovery.model.UnresolvedEntry;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class RecoveryRepository {

    @FunctionalInterface
    public interface CreatureIdResolver {
        long resolve(Connection conn, EntrySnapshot entry) throws SQLException;
    }

    private RecoveryRepository() {
        throw new AssertionError("No instances");
    }

    public static List<TableSnapshot> loadEncounterSnapshot(Connection conn) throws SQLException {
        Map<Long, MutableTableSnapshot> byId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT t.table_id, t.name, t.description, e.creature_id, e.weight, "
                        + "c.name AS creature_name, c.source_slug, c.slug_key "
                        + "FROM encounter_tables t "
                        + "LEFT JOIN encounter_table_entries e ON e.table_id = t.table_id "
                        + "LEFT JOIN creatures c ON c.id = e.creature_id "
                        + "ORDER BY t.table_id, e.creature_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long tableId = rs.getLong("table_id");
                MutableTableSnapshot table = byId.computeIfAbsent(tableId, id ->
                        new MutableTableSnapshot(id, rsGetString(rs, "name"), rsGetString(rs, "description")));
                long creatureId = rs.getLong("creature_id");
                if (!rs.wasNull()) {
                    table.entries().add(new EntrySnapshot(
                            creatureId,
                            rs.getInt("weight"),
                            rsGetString(rs, "creature_name"),
                            rsGetString(rs, "source_slug"),
                            rsGetString(rs, "slug_key")));
                }
            }
        }
        List<TableSnapshot> out = new ArrayList<>();
        for (MutableTableSnapshot m : byId.values()) {
            out.add(new TableSnapshot(m.tableId(), m.name(), m.description(), List.copyOf(m.entries())));
        }
        return out;
    }

    public static RecoveryRestoreResult recoverEncounterEntries(
            Connection conn,
            List<TableSnapshot> snapshot,
            CreatureIdResolver creatureIdResolver)
            throws SQLException {
        int restored = 0;
        List<UnresolvedEntry> unresolved = new ArrayList<>();

        try (PreparedStatement tableExists = conn.prepareStatement(
                "SELECT 1 FROM encounter_tables WHERE table_id = ?");
             PreparedStatement upsertEntry = conn.prepareStatement(
                     "INSERT INTO encounter_table_entries(table_id, creature_id, weight) VALUES(?, ?, ?) "
                             + "ON CONFLICT(table_id, creature_id) DO UPDATE SET weight=excluded.weight")) {
            for (TableSnapshot table : snapshot) {
                if (!exists(tableExists, table.tableId())) {
                    continue;
                }
                for (EntrySnapshot entry : table.entries()) {
                    long resolvedId = creatureIdResolver.resolve(conn, entry);
                    if (resolvedId <= 0) {
                        unresolved.add(new UnresolvedEntry(table.tableId(), table.name(), entry));
                        continue;
                    }
                    upsertEntry.setLong(1, table.tableId());
                    upsertEntry.setLong(2, resolvedId);
                    upsertEntry.setInt(3, entry.weight());
                    upsertEntry.executeUpdate();
                    restored++;
                }
            }
        }

        return new RecoveryRestoreResult(restored, List.copyOf(unresolved));
    }

    private static boolean exists(PreparedStatement ps, long id) throws SQLException {
        ps.clearParameters();
        ps.setLong(1, id);
        try (ResultSet rs = ps.executeQuery()) {
            return rs.next();
        }
    }

    private static String rsGetString(ResultSet rs, String column) {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            throw new IllegalStateException("Missing column in result set: " + column, e);
        }
    }

    private record MutableTableSnapshot(long tableId, String name, String description, List<EntrySnapshot> entries) {
        private MutableTableSnapshot(long tableId, String name, String description) {
            this(tableId, name, description, new ArrayList<>());
        }
    }
}
