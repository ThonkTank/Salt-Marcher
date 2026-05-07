package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanCreature;

public final class SaveEncounterPlanUseCase {

    private final EncounterPlanRepository repository;

    public SaveEncounterPlanUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public Result execute(long planId, String name, String generatedLabel, List<EncounterPlanCreature> creatures) {
        List<EncounterPlanCreature> safeCreatures = creatures == null ? List.of() : List.copyOf(creatures);
        if (safeCreatures.isEmpty()) {
            return Result.invalidRequest("Encounter plan needs at least one creature.");
        }
        try {
            return Result.success(repository.save(new EncounterPlan(planId, name, generatedLabel, safeCreatures)));
        } catch (IllegalArgumentException exception) {
            return Result.invalidRequest("Encounter plan is invalid.");
        } catch (IllegalStateException exception) {
            return Result.storageError("Encounter plan could not be saved.");
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
            return new Result(Status.SUCCESS, plan, "Encounter saved.");
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
        INVALID_REQUEST,
        STORAGE_ERROR
    }
}
