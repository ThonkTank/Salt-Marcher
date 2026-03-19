package features.world.quarantine.dungeonmap.foundation.db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

public final class DungeonPersistenceBatch {

    private DungeonPersistenceBatch() {
        throw new AssertionError("No instances");
    }

    public static <T> List<T> sanitizeList(List<T> list) {
        return (list == null ? List.<T>of() : list).stream()
                .filter(Objects::nonNull).toList();
    }

    @FunctionalInterface
    public interface SqlBinder<T> {
        void bind(PreparedStatement ps, T item) throws SQLException;
    }

    public static <T> void batchReplace(
            Connection conn,
            String deleteSql,
            long id,
            String insertSql,
            List<T> items,
            SqlBinder<T> binder
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(deleteSql)) {
            delete.setLong(1, id);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(insertSql)) {
            for (T item : items) {
                binder.bind(insert, item);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
