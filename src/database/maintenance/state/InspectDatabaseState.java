package database.maintenance.state;

import database.maintenance.input.InspectDatabaseInput;

import java.util.ArrayList;
import java.util.List;

@SuppressWarnings("unused")
public record InspectDatabaseState(
        String databasePath,
        boolean includeTableCounts,
        boolean exists,
        long byteSize,
        List<String> tables,
        List<String> tableCounts
) {

    public InspectDatabaseState {
        databasePath = databasePath == null ? "" : databasePath.trim();
        tables = normalizeTables(tables);
        tableCounts = normalizeCounts(tableCounts);
    }

    public static InspectDatabaseState inspectDatabase(InspectDatabaseInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new InspectDatabaseState(
                input.databasePath(),
                input.includeTableCounts(),
                false,
                0L,
                List.of(),
                List.of());
    }

    private static List<String> normalizeTables(List<String> tables) {
        ArrayList<String> normalized = new ArrayList<>();
        List<String> source = tables == null ? List.of() : tables;
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

    private static List<String> normalizeCounts(List<String> tableCounts) {
        ArrayList<String> normalized = new ArrayList<>();
        List<String> source = tableCounts == null ? List.of() : tableCounts;
        for (String tableCount : source) {
            if (tableCount == null) {
                continue;
            }
            String trimmed = tableCount.trim();
            if (!trimmed.isEmpty()) {
                normalized.add(trimmed);
            }
        }
        return normalized.isEmpty() ? List.of() : List.copyOf(normalized);
    }
}
