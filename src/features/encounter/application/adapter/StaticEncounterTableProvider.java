package features.encounter.application.adapter;

import features.encounter.application.EncounterApplicationService;
import features.encountertable.service.EncounterTableService;

import java.util.List;

public final class StaticEncounterTableProvider implements EncounterApplicationService.EncounterTableProvider {

    @Override
    public EncounterApplicationService.TableCatalogResult loadEncounterTables() {
        EncounterTableService.TableListResult result = EncounterTableService.loadAll();
        if (result.status() == EncounterTableService.ReadStatus.SUCCESS) {
            return new EncounterApplicationService.TableCatalogResult(
                    EncounterApplicationService.TableLoadStatus.SUCCESS,
                    result.tables());
        }
        return new EncounterApplicationService.TableCatalogResult(
                EncounterApplicationService.TableLoadStatus.STORAGE_ERROR,
                List.of());
    }

    @Override
    public EncounterApplicationService.CandidateSelection loadCandidates(List<Long> tableIds, int xpCeiling) {
        EncounterTableService.CandidatesResult result =
                EncounterTableService.getCandidatesFromTables(tableIds, xpCeiling);
        EncounterApplicationService.TableLoadStatus status = result.status() == EncounterTableService.ReadStatus.SUCCESS
                ? EncounterApplicationService.TableLoadStatus.SUCCESS
                : EncounterApplicationService.TableLoadStatus.STORAGE_ERROR;
        return new EncounterApplicationService.CandidateSelection(
                result.candidates(),
                result.selectionWeights(),
                status);
    }
}
