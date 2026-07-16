package features.encounter.api;

import java.util.List;

public record GeneratedEncounterPlanImportResult(
        Status status,
        List<ImportedPlan> plans,
        String message
) {

    public GeneratedEncounterPlanImportResult {
        status = status == null ? Status.STORAGE_FAILURE : status;
        plans = plans == null ? List.of() : List.copyOf(plans);
        message = message == null ? "" : message;
    }

    @Override
    public List<ImportedPlan> plans() {
        return List.copyOf(plans);
    }

    public static GeneratedEncounterPlanImportResult success(List<ImportedPlan> plans) {
        return new GeneratedEncounterPlanImportResult(Status.SUCCESS, plans, "Generated encounters imported.");
    }

    public static GeneratedEncounterPlanImportResult invalidRequest(String message) {
        return new GeneratedEncounterPlanImportResult(Status.INVALID_REQUEST, List.of(), message);
    }

    public static GeneratedEncounterPlanImportResult unresolvable(String message) {
        return new GeneratedEncounterPlanImportResult(Status.UNRESOLVABLE, List.of(), message);
    }

    public static GeneratedEncounterPlanImportResult storageFailure() {
        return new GeneratedEncounterPlanImportResult(
                Status.STORAGE_FAILURE,
                List.of(),
                "Generated encounters could not be saved.");
    }

    public enum Status {
        SUCCESS,
        INVALID_REQUEST,
        UNRESOLVABLE,
        STORAGE_FAILURE
    }

    public record ImportedPlan(int encounterNumber, long planId) {

        public ImportedPlan {
            if (encounterNumber <= 0 || planId <= 0) {
                throw new IllegalArgumentException("Imported encounter identity must be positive");
            }
        }
    }
}
