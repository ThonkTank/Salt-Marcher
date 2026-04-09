package database.maintenance.input;

import java.util.List;

@SuppressWarnings("unused")
public record InspectDatabaseInput(
        String databasePath,
        boolean includeTableCounts
) {

    public record InspectResultInput(
            String databasePath,
            boolean exists,
            long byteSize,
            List<String> tables,
            List<String> tableCounts
    ) {

        public InspectResultInput(
                database.maintenance.state.InspectDatabaseState state
        ) {
            this(
                    state == null ? "" : state.databasePath(),
                    state != null && state.exists(),
                    state == null ? 0L : state.byteSize(),
                    state == null ? List.of() : state.tables(),
                    state == null ? List.of() : state.tableCounts());
        }
    }
}
