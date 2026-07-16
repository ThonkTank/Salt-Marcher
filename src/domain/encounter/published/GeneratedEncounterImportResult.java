package src.domain.encounter.published;

import java.util.List;

public record GeneratedEncounterImportResult(
        Status status,
        List<ImportedEncounterPlan> plans,
        List<String> unresolvedSlots,
        String message
) {
    public GeneratedEncounterImportResult {
        status = status == null ? Status.FAILED : status;
        plans = plans == null ? List.of() : List.copyOf(plans);
        unresolvedSlots = unresolvedSlots == null ? List.of() : List.copyOf(unresolvedSlots);
        message = message == null ? "" : message;
    }

    public static GeneratedEncounterImportResult unavailable(String message) {
        return new GeneratedEncounterImportResult(Status.FAILED, List.of(), List.of(), message);
    }

    public enum Status {
        SUCCESS,
        UNRESOLVED_CREATURES,
        FAILED
    }

    public record ImportedEncounterPlan(int encounterNumber, long planId, String name) {
    }
}
