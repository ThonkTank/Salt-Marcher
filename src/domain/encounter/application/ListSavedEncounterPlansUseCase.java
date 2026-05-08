package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanSummary;

public final class ListSavedEncounterPlansUseCase {

    private final EncounterPlanRepository repository;

    public ListSavedEncounterPlansUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public Result execute() {
        try {
            return Result.success(repository.list());
        } catch (IllegalStateException exception) {
            return Result.storageError("Encounter plans could not be loaded.");
        }
    }

    public record Result(
            Status status,
            List<EncounterPlanSummary> plans,
            String message
    ) {
        public Result {
            status = status == null ? Status.STORAGE_ERROR : status;
            plans = plans == null ? List.of() : List.copyOf(plans);
            message = message == null ? "" : message;
        }

        static Result success(List<EncounterPlanSummary> plans) {
            return new Result(Status.SUCCESS, plans, "");
        }

        static Result storageError(String message) {
            return new Result(Status.STORAGE_ERROR, List.of(), message);
        }
    }

    public enum Status {
        SUCCESS,
        STORAGE_ERROR;

        public boolean loadedSuccessfully() {
            return this == SUCCESS;
        }
    }
}
