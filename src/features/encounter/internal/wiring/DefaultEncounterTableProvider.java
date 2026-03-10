package features.encounter.internal.wiring;

import features.encounter.builder.application.ports.EncounterTableProvider;
import features.encountertable.api.EncounterTableApi;

import java.util.List;

public final class DefaultEncounterTableProvider implements EncounterTableProvider {

    @Override
    public TableCatalogResult loadEncounterTables() {
        EncounterTableApi.TableCatalogResult result = EncounterTableApi.loadAll();
        if (result.status() == EncounterTableApi.ReadStatus.SUCCESS) {
            return new TableCatalogResult(
                    TableLoadStatus.SUCCESS,
                    result.tables());
        }
        return new TableCatalogResult(
                TableLoadStatus.STORAGE_ERROR,
                List.of());
    }

    @Override
    public CandidateSelection loadCandidates(List<Long> tableIds, int xpCeiling) {
        EncounterTableApi.CandidateSelectionResult result =
                EncounterTableApi.loadCandidates(tableIds, xpCeiling);
        TableLoadStatus status = result.status() == EncounterTableApi.ReadStatus.SUCCESS
                ? TableLoadStatus.SUCCESS
                : TableLoadStatus.STORAGE_ERROR;
        return new CandidateSelection(
                result.candidates(),
                result.selectionWeights(),
                status);
    }
}
