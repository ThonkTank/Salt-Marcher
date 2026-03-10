package features.encounter.builder.application.ports;

import features.creatures.model.Creature;
import features.encountertable.model.EncounterTable;

import java.util.List;
import java.util.Map;

public interface EncounterTableProvider {

    TableCatalogResult loadEncounterTables();

    CandidateSelection loadCandidates(List<Long> tableIds, int xpCeiling);

    enum TableLoadStatus { SUCCESS, STORAGE_ERROR }

    record TableCatalogResult(TableLoadStatus status, List<EncounterTable> tables) {}

    record CandidateSelection(
            List<Creature> candidates,
            Map<Long, Integer> selectionWeights,
            TableLoadStatus status
    ) {}
}
