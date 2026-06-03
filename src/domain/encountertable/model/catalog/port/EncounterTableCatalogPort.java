package src.domain.encountertable.model.catalog.port;

import java.util.List;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;

public interface EncounterTableCatalogPort {

    List<EncounterTableSummaryData> loadSummaries();

    List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp);
}
