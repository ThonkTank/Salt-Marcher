package src.domain.encountertable.model.catalog.repository;

import java.util.List;
import src.domain.encountertable.model.catalog.model.EncounterTableSummaryData;

public interface EncounterTablePublishedStateRepository {

    String SUCCESS = "SUCCESS";
    String STORAGE_ERROR = "STORAGE_ERROR";

    void publishCatalog(CatalogPublication result);

    final class CatalogPublication {
        private final String status;
        private final List<EncounterTableSummaryData> tables;

        public CatalogPublication(String status, List<EncounterTableSummaryData> tables) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.tables = tables == null ? List.of() : List.copyOf(tables);
        }

        public String status() {
            return status;
        }

        public List<EncounterTableSummaryData> tables() {
            return List.copyOf(tables);
        }
    }
}
