package features.items.api;

import java.time.Instant;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;

/** Explicit maintenance capability; application startup and UI must never invoke it. */
public interface ItemsImportApi {

    CompletionStage<ImportResult> importPublicSrd();

    enum ImportStatus {
        SUCCESS,
        SOURCE_ERROR,
        VALIDATION_ERROR,
        BACKUP_ERROR,
        STORAGE_ERROR,
        EXECUTION_ERROR
    }

    record ImportResult(
            ImportStatus status,
            int itemCount,
            @Nullable Instant backupCreatedAt
    ) {
        public ImportResult {
            status = status == null ? ImportStatus.STORAGE_ERROR : status;
            itemCount = Math.max(0, itemCount);
        }

        public static ImportResult failure(ImportStatus status) {
            return new ImportResult(status, 0, null);
        }
    }
}
