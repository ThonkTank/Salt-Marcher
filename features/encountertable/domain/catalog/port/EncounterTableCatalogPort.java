package features.encountertable.domain.catalog.port;

import java.util.List;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;

public interface EncounterTableCatalogPort {

    List<EncounterTableSummaryData> loadSummaries();

    List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp);
}
