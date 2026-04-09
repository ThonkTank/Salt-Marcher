package database.maintenance.input;

import java.util.List;

@SuppressWarnings("unused")
public record ResetDatabaseInput(
        String target,
        boolean backupBeforeReset,
        String backupPath
) {

    public record ResetResultInput(
            String target,
            String backupPath,
            List<String> droppedTables
    ) {

        public ResetResultInput(
                database.maintenance.state.ResetDatabaseState state
        ) {
            this(
                    state == null ? "" : state.target(),
                    state == null ? "" : state.backupPath(),
                    state == null ? List.of() : state.droppedTables());
        }
    }
}
