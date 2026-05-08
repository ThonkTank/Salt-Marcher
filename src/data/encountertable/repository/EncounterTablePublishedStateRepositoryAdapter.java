package src.data.encountertable.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.runtime.port.EncounterTablePublishedStateRepository;

public final class EncounterTablePublishedStateRepositoryAdapter implements EncounterTablePublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final List<Consumer<EncounterTableCatalogResult>> catalogListeners = new ArrayList<>();

    public final EncounterTableCatalogModel catalogModel = new EncounterTableCatalogModel(
            this::currentCatalog,
            this::subscribeCatalogListener);

    private EncounterTableCatalogResult currentCatalog =
            new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());

    @Override
    public void publishCatalog(CatalogPublication publication) {
        CatalogPublication safePublication = publication == null
                ? new CatalogPublication(CatalogStatus.STORAGE_ERROR, List.of())
                : publication;
        currentCatalog = new EncounterTableCatalogResult(
                safePublication.status() == CatalogStatus.SUCCESS
                        ? EncounterTableReadStatus.SUCCESS
                        : EncounterTableReadStatus.STORAGE_ERROR,
                safePublication.tables().stream()
                        .map(EncounterTablePublishedStateRepositoryAdapter::toPublishedSummary)
                        .toList());
        for (Consumer<EncounterTableCatalogResult> listener : List.copyOf(catalogListeners)) {
            listener.accept(currentCatalog);
        }
    }

    private EncounterTableCatalogResult currentCatalog() {
        return currentCatalog;
    }

    private Runnable subscribeCatalogListener(Consumer<EncounterTableCatalogResult> listener) {
        Consumer<EncounterTableCatalogResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        catalogListeners.add(safeListener);
        return () -> catalogListeners.remove(safeListener);
    }

    private static EncounterTableSummary toPublishedSummary(EncounterTableSummaryData summary) {
        EncounterTableSummaryData safeSummary =
                summary == null ? new EncounterTableSummaryData(0L, "", null) : summary;
        return new EncounterTableSummary(
                safeSummary.tableId(),
                safeSummary.name(),
                safeSummary.linkedLootTableId());
    }
}
