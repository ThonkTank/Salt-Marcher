package src.domain.encountertable.model.catalog.repository;

import java.util.List;
import src.domain.encountertable.model.catalog.model.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.model.EncounterTableSummaryData;

public interface EncounterTableCatalogRepository {

    List<EncounterTableSummaryData> loadSummaries();

    List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp);
}
