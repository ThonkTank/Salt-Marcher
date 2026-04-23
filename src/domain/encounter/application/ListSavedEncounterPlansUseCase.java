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

    public List<EncounterPlanSummary> execute() {
        return repository.list();
    }
}
