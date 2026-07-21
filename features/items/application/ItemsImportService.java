package features.items.application;

import features.items.api.ItemsImportApi;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import features.items.domain.importing.ItemImportStore;
import features.items.domain.importing.PublicItemSource;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;

/** Operator-only application service for replacing the local Items reference corpus. */
public final class ItemsImportService implements ItemsImportApi {

  private static final DiagnosticId SOURCE_FAILURE =
      new DiagnosticId("items.import.source-failure");
  private static final DiagnosticId VALIDATION_FAILURE =
      new DiagnosticId("items.import.validation-failure");
  private static final DiagnosticId BACKUP_FAILURE =
      new DiagnosticId("items.import.backup-failure");
  private static final DiagnosticId STORAGE_FAILURE =
      new DiagnosticId("items.import.storage-failure");
  private static final DiagnosticId EXECUTION_FAILURE =
      new DiagnosticId("items.import.execution-failure");

  private final PublicItemSource publicSource;
  private final ItemImportStore importStore;
  private final ExecutionLane executionLane;
  private final Diagnostics diagnostics;

  public ItemsImportService(
      PublicItemSource publicSource,
      ItemImportStore importStore,
      ExecutionLane executionLane,
      Diagnostics diagnostics) {
    this.publicSource = Objects.requireNonNull(publicSource, "publicSource");
    this.importStore = Objects.requireNonNull(importStore, "importStore");
    this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
  }

  @Override
  public CompletionStage<ImportResult> importPublicSrd() {
    CompletableFuture<ImportResult> response = new CompletableFuture<>();
    try {
      executionLane.execute(
          () -> {
            try {
              response.complete(importNow());
            } catch (RuntimeException exception) {
              diagnostics.failure(EXECUTION_FAILURE, exception.getClass());
              response.complete(ImportResult.failure(ImportStatus.EXECUTION_ERROR));
            }
          });
    } catch (RuntimeException exception) {
      diagnostics.failure(EXECUTION_FAILURE, exception.getClass());
      response.complete(ImportResult.failure(ImportStatus.EXECUTION_ERROR));
    }
    return response;
  }

  private ImportResult importNow() {
    List<ImportedItem> fetched;
    try {
      fetched = publicSource.fetchAll();
    } catch (IllegalStateException exception) {
      diagnostics.failure(SOURCE_FAILURE, exception.getClass());
      return ImportResult.failure(ImportStatus.SOURCE_ERROR);
    }

    ItemImportBatch batch;
    try {
      batch = new ItemImportBatch(fetched);
    } catch (IllegalArgumentException exception) {
      diagnostics.failure(VALIDATION_FAILURE, exception.getClass());
      return ImportResult.failure(ImportStatus.VALIDATION_ERROR);
    }

    ItemImportStore.BackupReceipt backup;
    try {
      importStore.initialize();
      backup = importStore.createVerifiedBackup();
    } catch (IllegalStateException exception) {
      diagnostics.failure(BACKUP_FAILURE, exception.getClass());
      return ImportResult.failure(ImportStatus.BACKUP_ERROR);
    }

    try {
      importStore.replaceAll(batch);
      return new ImportResult(ImportStatus.SUCCESS, batch.items().size(), backup.createdAt());
    } catch (IllegalStateException exception) {
      diagnostics.failure(STORAGE_FAILURE, exception.getClass());
      return ImportResult.failure(ImportStatus.STORAGE_ERROR);
    }
  }
}
