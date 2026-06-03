package src.domain.encountertable.model.catalog.repository;

import java.util.List;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;

public interface EncounterTablePublishedStateRepository {

    String SUCCESS = "SUCCESS";
    String STORAGE_ERROR = "STORAGE_ERROR";

    void publishCatalog(CatalogPublication result);

    void publishCandidates(CandidatesPublication result);

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

    final class CandidatesPublication {
        private final String status;
        private final List<src.domain.encountertable.model.catalog.EncounterTableCandidateData> candidates;

        public CandidatesPublication(
                String status,
                List<src.domain.encountertable.model.catalog.EncounterTableCandidateData> candidates
        ) {
            this.status = status == null ? STORAGE_ERROR : status;
            this.candidates = candidates == null ? List.of() : List.copyOf(candidates);
        }

        public String status() {
            return status;
        }

        public List<src.domain.encountertable.model.catalog.EncounterTableCandidateData> candidates() {
            return List.copyOf(candidates);
        }
    }
}
