package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanCreature;

public final class SaveEncounterPlanUseCase {

    private final EncounterPlanRepository repository;

    public SaveEncounterPlanUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public EncounterPlan execute(long planId, String name, String generatedLabel, List<EncounterPlanCreature> creatures) {
        return repository.save(new EncounterPlan(planId, name, generatedLabel, creatures));
    }
}
