package src.domain.encounter.runtime.service;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterBuilderInputsBoundaryTranslator;
import src.domain.encounter.application.EncounterStateBoundaryTranslator;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.value.EncounterSessionCommand;

public final class EncounterApplicationRuntimeAccess {

    private static final long INITIAL_PLAN_ID = 0L;

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final EncounterSessionPublicationAccess sessionPublicationAccess;
    private final EncounterPlanPublicationAccess planPublicationAccess;

    public EncounterApplicationRuntimeAccess(EncounterRuntimeBootstrap bootstrap) {
        this.applySessionUseCase = bootstrap.applySessionUseCase();
        this.sessionPublicationAccess = bootstrap.sessionPublicationAccess();
        this.planPublicationAccess = bootstrap.planPublicationAccess();
        sessionPublicationAccess.publishCurrentSession(currentSession());
        planPublicationAccess.publishSavedPlans();
        planPublicationAccess.publishPlanBudget(INITIAL_PLAN_ID);
    }

    public void applyState(@Nullable ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            sessionPublicationAccess.publishCurrentSession(null);
            return;
        }
        EncounterSession session = useCase.apply(EncounterStateBoundaryTranslator.toInternalCommand(command));
        sessionPublicationAccess.publishCurrentSession(session);
        if (command == null || command.action().republishesSavedPlans()) {
            planPublicationAccess.publishSavedPlans();
        }
    }

    public void updateBuilderInputs(@Nullable UpdateEncounterBuilderInputsCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            sessionPublicationAccess.publishCurrentSession(null);
            return;
        }
        UpdateEncounterBuilderInputsCommand effective = command == null
                ? new UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                EncounterBuilderInputsBoundaryTranslator.toInternal(effective.inputs())));
        sessionPublicationAccess.publishCurrentSession(session);
    }

    public void refreshPlanBudget(long planId) {
        planPublicationAccess.publishPlanBudget(planId);
    }

    private @Nullable EncounterSession currentSession() {
        return applySessionUseCase == null ? null : applySessionUseCase.session();
    }
}
