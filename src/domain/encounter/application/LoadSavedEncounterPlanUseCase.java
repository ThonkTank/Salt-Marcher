package src.domain.encounter.application;

import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;

public final class LoadSavedEncounterPlanUseCase {

    private final EncounterPlanRepository repository;

    public LoadSavedEncounterPlanUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public Result execute(long planId) {
        if (planId <= 0) {
            return Result.invalidRequest("Encounter plan id must be positive.");
        }
        try {
            Optional<EncounterPlan> loaded = repository.load(planId);
            return loaded.map(Result::success)
                    .orElseGet(() -> Result.notFound("Encounter plan not found."));
        } catch (RuntimeException exception) {
            return Result.storageError("Encounter plan could not be loaded.");
        }
    }

    public record Result(
            Status status,
            @Nullable EncounterPlan plan,
            String message
    ) {
        public Result {
            status = status == null ? Status.STORAGE_ERROR : status;
            message = message == null ? "" : message;
        }

        static Result success(EncounterPlan plan) {
            return new Result(Status.SUCCESS, plan, "Encounter loaded.");
        }

        static Result notFound(String message) {
            return new Result(Status.NOT_FOUND, null, message);
        }

        static Result invalidRequest(String message) {
            return new Result(Status.INVALID_REQUEST, null, message);
        }

        static Result storageError(String message) {
            return new Result(Status.STORAGE_ERROR, null, message);
        }
    }

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        INVALID_REQUEST,
        STORAGE_ERROR
    }
}
