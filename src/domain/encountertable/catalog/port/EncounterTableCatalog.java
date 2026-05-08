package src.domain.encountertable.catalog.port;

import java.util.List;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;
import src.domain.encountertable.published.EncounterTableSummary;

public interface EncounterTableCatalog {

    List<EncounterTableSummary> loadSummaries();

    List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp);
}
