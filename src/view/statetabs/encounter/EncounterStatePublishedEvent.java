package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterStatePublishedEvent(Mutation mutation) {

    public EncounterStatePublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits EncounterStateViewInputEvent.GeneratorAction,
            EncounterStateViewInputEvent.PlanAction, EncounterStateViewInputEvent.RosterAction,
            EncounterStateViewInputEvent.UndoAction, EncounterStateViewInputEvent.BuilderModeAction,
            EncounterStateViewInputEvent.InitiativeInput, EncounterStateViewInputEvent.SimpleCombatAction,
            EncounterStateViewInputEvent.HpChangeAction, EncounterStateViewInputEvent.InitiativeEditAction,
            EncounterStateViewInputEvent.PartyMemberJoinAction, EncounterStateViewInputEvent.ResultInput {
    }
}
