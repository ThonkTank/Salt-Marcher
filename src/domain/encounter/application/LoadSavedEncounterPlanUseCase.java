package src.domain.encounter.application;

import java.util.Objects;
import java.util.Optional;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;

public final class LoadSavedEncounterPlanUseCase {

    private final EncounterPlanRepository repository;

    public LoadSavedEncounterPlanUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public Optional<EncounterPlan> execute(long planId) {
        if (planId <= 0) {
            throw new IllegalArgumentException("Encounter plan id must be positive.");
        }
        try {
            return repository.load(planId);
        } catch (IllegalStateException exception) {
            throw new IllegalStateException("Encounter plan could not be loaded.", exception);
        }
    }
}
