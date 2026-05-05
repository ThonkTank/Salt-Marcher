package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlanStatus;

public final class ListSavedEncounterPlansUseCase {

    private final EncounterPlanRepository repository;

    public ListSavedEncounterPlansUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public Result execute() {
        try {
            return Result.success(repository.list());
        } catch (RuntimeException exception) {
            return Result.storageError("Encounter plans could not be loaded.");
        }
    }

    public record Result(
            SavedEncounterPlanStatus status,
            List<EncounterPlanSummary> plans,
            String message
    ) {
        public Result {
            status = status == null ? SavedEncounterPlanStatus.STORAGE_ERROR : status;
            plans = plans == null ? List.of() : List.copyOf(plans);
            message = message == null ? "" : message;
        }

        static Result success(List<EncounterPlanSummary> plans) {
            return new Result(SavedEncounterPlanStatus.SUCCESS, plans, "");
        }

        static Result storageError(String message) {
            return new Result(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), message);
        }
    }
}
