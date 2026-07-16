package src.domain.encountertable;

import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableReferenceApi;

public final class EncounterTableServiceAssembly {

    private EncounterTableServiceAssembly() {
    }

    public static Component create(EncounterTableCatalogPort catalogPort) {
        EncounterTableCatalogModel catalog = new EncounterTableCatalogModel();
        EncounterTableCandidatesModel candidates = new EncounterTableCandidatesModel();
        EncounterTableReferenceApi references = () -> {
            try {
                return new EncounterTableCatalogResult(
                        EncounterTableReadStatus.SUCCESS,
                        EncounterTableCatalogProjection.summaries(catalogPort.loadSummaries()));
            } catch (IllegalStateException exception) {
                return new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, java.util.List.of());
            }
        };
        return new Component(
                new EncounterTableApplicationService(catalogPort, catalog, candidates),
                references,
                catalog,
                candidates);
    }

    public record Component(
            EncounterTableApplicationService application,
            EncounterTableReferenceApi references,
            EncounterTableCatalogModel catalog,
            EncounterTableCandidatesModel candidates
    ) {
    }
}
