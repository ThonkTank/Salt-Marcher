package features.encounter.service.adapter;

import features.encounter.service.EncounterService;
import features.encountertable.service.EncounterTableService;

import java.util.List;

public final class StaticEncounterTableProvider implements EncounterService.EncounterTableProvider {

    @Override
    public EncounterService.TableCatalogResult loadEncounterTables() {
        EncounterTableService.TableListResult result = EncounterTableService.loadAll();
        if (result.status() == EncounterTableService.ReadStatus.SUCCESS) {
            return new EncounterService.TableCatalogResult(EncounterService.TableLoadStatus.SUCCESS, result.tables());
        }
        return new EncounterService.TableCatalogResult(EncounterService.TableLoadStatus.STORAGE_ERROR, List.of());
    }

    @Override
    public EncounterService.CandidateSelection loadCandidates(List<Long> tableIds, int xpCeiling) {
        EncounterTableService.CandidatesResult result =
                EncounterTableService.getCandidatesFromTables(tableIds, xpCeiling);
        EncounterService.TableLoadStatus status = result.status() == EncounterTableService.ReadStatus.SUCCESS
                ? EncounterService.TableLoadStatus.SUCCESS
                : EncounterService.TableLoadStatus.STORAGE_ERROR;
        return new EncounterService.CandidateSelection(result.candidates(), result.selectionWeights(), status);
    }
}
