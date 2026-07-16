package features.items;

import features.items.api.ItemsImportApi.ImportResult;
import features.items.api.ItemsImportApi.ImportStatus;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;

/** Explicit command-line import entrypoint; it is intentionally absent from desktop composition. */
public final class ItemsImportCommand {

    private ItemsImportCommand() {
    }

    public static void main(String[] arguments) {
        try (SqliteDatabase database = SqliteDatabase.defaultDatabase(
                        SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                        NoopDiagnostics.INSTANCE);
             SerialExecutionLane lane = new SerialExecutionLane(NoopDiagnostics.INSTANCE)) {
            ImportResult result = ItemsServiceAssembly.create(
                            database,
                            lane,
                            NoopDiagnostics.INSTANCE)
                    .importer()
                    .importPublicSrd()
                    .toCompletableFuture()
                    .join();
            if (result.status() != ImportStatus.SUCCESS) {
                throw new IllegalStateException("Items import failed with status " + result.status());
            }
        }
    }
}
