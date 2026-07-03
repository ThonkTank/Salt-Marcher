package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.session.EncounterInitiativeInput;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionCommand;
import src.domain.encounter.model.session.usecase.ApplyEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;

public final class ApplyEncounterStateUseCase {

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final PublishEncounterSessionUseCase publishSessionUseCase;
    private final PublishEncounterSavedPlansUseCase publishSavedPlansUseCase;

    public ApplyEncounterStateUseCase(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            PublishEncounterSessionUseCase publishSessionUseCase,
            PublishEncounterSavedPlansUseCase publishSavedPlansUseCase
    ) {
        this.applySessionUseCase = applySessionUseCase;
        this.publishSessionUseCase = java.util.Objects.requireNonNull(publishSessionUseCase, "publishSessionUseCase");
        this.publishSavedPlansUseCase = java.util.Objects.requireNonNull(publishSavedPlansUseCase, "publishSavedPlansUseCase");
    }

    public void execute(@Nullable Request request) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        EncounterSessionCommand effective = toSessionCommand(request);
        EncounterSession session = useCase.apply(effective);
        publishSessionUseCase.execute(session);
        if (effective.action().republishesSavedPlans()) {
            publishSavedPlansUseCase.execute();
        }
    }

    private static EncounterSessionCommand toSessionCommand(@Nullable Request request) {
        Request effective = request == null ? Request.refresh() : request;
        return new EncounterSessionCommand(
                toAction(effective.actionName()),
                java.util.Optional.empty(),
                EncounterGenerationInputs.empty(),
                effective.creatureId(),
                effective.planId(),
                effective.worldNpcId(),
                effective.delta(),
                effective.undoToken(),
                initiativeInputs(effective.initiativeValues()),
                effective.combatantId(),
                effective.initiative(),
                effective.partyMemberId(),
                effective.amount(),
                effective.healing());
    }

    private static EncounterSessionCommand.Action toAction(@Nullable String actionName) {
        if (actionName == null || actionName.isBlank()) {
            return EncounterSessionCommand.Action.REFRESH;
        }
        return EncounterSessionCommand.Action.valueOf(actionName);
    }

    private static List<EncounterInitiativeInput> initiativeInputs(List<InitiativeInput> values) {
        if (values == null) {
            return List.of();
        }
        List<EncounterInitiativeInput> inputs = new ArrayList<>(values.size());
        for (InitiativeInput value : values) {
            inputs.add(new EncounterInitiativeInput(value.id(), value.initiative()));
        }
        return List.copyOf(inputs);
    }

    public record InitiativeInput(String id, int initiative) { }

    public record Request(
            @Nullable String actionName,
            long creatureId,
            long planId,
            long worldNpcId,
            int delta,
            long undoToken,
            List<InitiativeInput> initiativeValues,
            @Nullable String combatantId,
            int initiative,
            long partyMemberId,
            int amount,
            boolean healing
    ) {
        public Request {
            initiativeValues = initiativeValues == null ? List.of() : List.copyOf(initiativeValues);
        }

        public static Request refresh() {
            return new Request(
                    null,
                    0L,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    null,
                    0,
                    0L,
                    0,
                    false);
        }
    }
}
