package src.domain.encounter.model.plan.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.plan.model.EncounterPlanCreature;

public final class SaveEncounterPlanUseCase {

    private final EncounterPlanRepository repository;

    public SaveEncounterPlanUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public EncounterPlan execute(long planId, String name, String generatedLabel, List<EncounterPlanCreature> creatures) {
        List<EncounterPlanCreature> safeCreatures = creatures == null ? List.of() : List.copyOf(creatures);
        if (safeCreatures.isEmpty()) {
            throw new IllegalArgumentException("Encounter plan needs at least one creature.");
        }
        try {
            return repository.save(new EncounterPlan(planId, name, generatedLabel, safeCreatures));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Encounter plan is invalid.", exception);
        } catch (IllegalStateException exception) {
            throw new IllegalStateException("Encounter plan could not be saved.", exception);
        }
    }
}
