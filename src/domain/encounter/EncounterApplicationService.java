package src.domain.encounter;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.runtime.port.EncounterSessionPublishedStateRepository;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.encountertable.EncounterTableApplicationService;

/**
 * Public encounter facade that owns command publication and same-context model
 * refresh for the encounter feature.
 */
public final class EncounterApplicationService {

    private final EncounterApplicationRuntimeAccess runtimeAccess;

    public EncounterApplicationService(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable EncounterPlanRepository encounterPlans,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository
    ) {
        this.runtimeAccess = new EncounterApplicationRuntimeAccess(EncounterRuntimeBootstrap.create(
                party,
                creatures,
                encounterTables,
                encounterPlans,
                sessionPublishedStateRepository));
    }

    public void applyState(ApplyEncounterStateCommand command) {
        runtimeAccess.applyState(command);
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        runtimeAccess.updateBuilderInputs(command);
    }
}
