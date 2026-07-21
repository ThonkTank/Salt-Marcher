package app;

import features.items.ItemsImportAssembly;
import features.items.ItemsServiceAssembly;
import features.items.api.ItemsImportApi.ImportResult;
import features.items.api.ItemsImportApi.ImportStatus;

import platform.diagnostics.NoopDiagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;

/** Explicit command-line import composition; it is intentionally absent from desktop startup. */
public final class ItemsImportCommand {

    private ItemsImportCommand() {}

    public static void main(String[] arguments) {
        try (SqliteDatabase database =
                        SqliteDatabase.defaultDatabase(
                                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                                NoopDiagnostics.INSTANCE);
                SerialExecutionLane lane = new SerialExecutionLane(NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(ItemsServiceAssembly.storeDefinition());
            var maintenance = database.maintenanceFor(store);
            database.prepareRegisteredStores();
            ImportResult result =
                    ItemsImportAssembly.create(
                                    maintenance, lane, NoopDiagnostics.INSTANCE)
                            .importPublicSrd()
                            .toCompletableFuture()
                            .join();
            if (result.status() != ImportStatus.SUCCESS) {
                throw new IllegalStateException(
                        "Items import failed with status " + result.status());
            }
        }
    }
}
