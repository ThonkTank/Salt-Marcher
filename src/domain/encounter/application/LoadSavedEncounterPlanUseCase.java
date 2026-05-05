package src.domain.encounter.application;

import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.published.SavedEncounterPlanStatus;

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
            SavedEncounterPlanStatus status,
            @Nullable EncounterPlan plan,
            String message
    ) {
        public Result {
            status = status == null ? SavedEncounterPlanStatus.STORAGE_ERROR : status;
            message = message == null ? "" : message;
        }

        static Result success(EncounterPlan plan) {
            return new Result(SavedEncounterPlanStatus.SUCCESS, plan, "Encounter loaded.");
        }

        static Result notFound(String message) {
            return new Result(SavedEncounterPlanStatus.NOT_FOUND, null, message);
        }

        static Result invalidRequest(String message) {
            return new Result(SavedEncounterPlanStatus.INVALID_REQUEST, null, message);
        }

        static Result storageError(String message) {
            return new Result(SavedEncounterPlanStatus.STORAGE_ERROR, null, message);
        }
    }
}
