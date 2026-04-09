package database.maintenance.state;

import database.maintenance.input.ResetDatabaseInput;

import java.util.ArrayList;
import java.util.List;

@SuppressWarnings("unused")
public record ResetDatabaseState(
        String target,
        boolean backupBeforeReset,
        String backupPath,
        List<String> droppedTables
) {

    public ResetDatabaseState {
        target = target == null ? "" : target.trim();
        backupPath = backupPath == null ? "" : backupPath.trim();
        droppedTables = normalizeTables(droppedTables);
    }

    public static ResetDatabaseState resetDatabase(ResetDatabaseInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new ResetDatabaseState(
                input.target(),
                input.backupBeforeReset(),
                input.backupPath(),
                List.of());
    }

    private static List<String> normalizeTables(List<String> droppedTables) {
        ArrayList<String> normalized = new ArrayList<>();
        List<String> source = droppedTables == null ? List.of() : droppedTables;
        for (String table : source) {
            if (table == null) {
                continue;
            }
            String trimmed = table.trim();
            if (!trimmed.isEmpty()) {
                normalized.add(trimmed);
            }
        }
        return normalized.isEmpty() ? List.of() : List.copyOf(normalized);
    }
}
