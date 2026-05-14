package src.domain.encounter.application;

import java.util.Objects;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;

public final class ListSavedEncounterPlansUseCase {

    private final EncounterPlanRepository repository;

    public ListSavedEncounterPlansUseCase(EncounterPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public SavedEncounterPlansLoadResult execute() {
        try {
            return SavedEncounterPlansLoadResult.success(repository.list());
        } catch (IllegalStateException exception) {
            return SavedEncounterPlansLoadResult.storageError("Encounter plans could not be loaded.");
        }
    }
}
