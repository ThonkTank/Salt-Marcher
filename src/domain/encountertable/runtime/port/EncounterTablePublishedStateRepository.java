package src.domain.encountertable.runtime.port;

import java.util.List;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;

public interface EncounterTablePublishedStateRepository {

    void publishCatalog(CatalogPublication publication);

    enum CatalogStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    record CatalogPublication(
            CatalogStatus status,
            List<EncounterTableSummaryData> tables
    ) {

        public CatalogPublication {
            status = status == null ? CatalogStatus.STORAGE_ERROR : status;
            tables = tables == null ? List.of() : List.copyOf(tables);
        }
    }
}
