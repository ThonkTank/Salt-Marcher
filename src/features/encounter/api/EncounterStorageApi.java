package features.encounter.api;

import features.encounter.model.Encounter;
import features.encounter.service.EncounterStorageService;

import java.util.List;

/**
 * Public cross-feature facade for persisted encounter snapshots.
 */
public final class EncounterStorageApi {

    private EncounterStorageApi() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public enum SaveStatus {
        SAVED,
        STORAGE_ERROR,
        INVALID_INPUT
    }

    public record EncounterSummary(
            long encounterId,
            String name,
            String difficulty,
            String shapeLabel,
            int slotCount
    ) {
        @Override
        public String toString() {
            return name != null ? name : "";
        }
    }

    public record StoredEncounter(
            long encounterId,
            String name,
            Encounter encounter
    ) {}

    public record EncounterSummaryCatalogResult(ReadStatus status, List<EncounterSummary> encounters) {}
    public record StoredEncounterResult(ReadStatus status, StoredEncounter encounter) {}
    public record SaveEncounterResult(SaveStatus status, Long encounterId) {}

    public static EncounterSummaryCatalogResult loadAllSummaries() {
        EncounterStorageService.EncounterSummaryCatalogResult result = EncounterStorageService.loadAllSummaries();
        return new EncounterSummaryCatalogResult(
                mapReadStatus(result.status()),
                result.encounters().stream()
                        .map(summary -> new EncounterSummary(
                                summary.encounterId(),
                                summary.name(),
                                summary.difficulty(),
                                summary.shapeLabel(),
                                summary.slotCount()))
                        .toList());
    }

    public static StoredEncounterResult loadEncounter(long encounterId) {
        EncounterStorageService.StoredEncounterResult result = EncounterStorageService.loadEncounter(encounterId);
        EncounterStorageService.StoredEncounter encounter = result.encounter();
        return new StoredEncounterResult(
                mapReadStatus(result.status()),
                encounter == null ? null : new StoredEncounter(encounter.encounterId(), encounter.name(), encounter.encounter()));
    }

    public static SaveEncounterResult saveEncounter(String name, Encounter encounter) {
        EncounterStorageService.SaveEncounterResult result = EncounterStorageService.saveEncounter(name, encounter);
        return new SaveEncounterResult(mapSaveStatus(result.status()), result.encounterId());
    }

    private static ReadStatus mapReadStatus(EncounterStorageService.ReadStatus status) {
        return status == EncounterStorageService.ReadStatus.SUCCESS
                ? ReadStatus.SUCCESS
                : ReadStatus.STORAGE_ERROR;
    }

    private static SaveStatus mapSaveStatus(EncounterStorageService.SaveStatus status) {
        return switch (status) {
            case SAVED -> SaveStatus.SAVED;
            case STORAGE_ERROR -> SaveStatus.STORAGE_ERROR;
            case INVALID_INPUT -> SaveStatus.INVALID_INPUT;
        };
    }
}
