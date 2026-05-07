package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;

public record EncounterStateViewInputEvent(Input input) {

    public EncounterStateViewInputEvent {
        Objects.requireNonNull(input, "input");
    }

    public sealed interface Input permits BuilderInput, DetailSelectionInput, InitiativeInput, CombatInput, ResultInput {
    }

    public record BuilderInput(BuilderAction action) implements Input {
        public BuilderInput {
            Objects.requireNonNull(action, "action");
        }

        public sealed interface BuilderAction permits GeneratorAction, PlanAction, RosterAction, UndoAction,
                BuilderModeAction {
        }
    }

    public record GeneratorAction(boolean generateRequested, int alternativeShift)
            implements BuilderInput.BuilderAction, EncounterStatePublishedEvent.Mutation {
    }

    public record PlanAction(boolean saveCurrentPlanRequested, long selectedPlanId)
            implements BuilderInput.BuilderAction, EncounterStatePublishedEvent.Mutation {
        public PlanAction {
            selectedPlanId = Math.max(0L, selectedPlanId);
        }
    }

    public record RosterAction(long creatureId, int delta, boolean removalRequested)
            implements BuilderInput.BuilderAction, EncounterStatePublishedEvent.Mutation {
        public RosterAction {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record UndoAction(EncounterStateUndoRef undo)
            implements BuilderInput.BuilderAction, EncounterStatePublishedEvent.Mutation {
        public UndoAction {
            undo = undo == null ? new EncounterStateUndoRef(0L) : undo;
        }
    }

    public record BuilderModeAction(boolean clearHistoryRequested, boolean startInitiativeRequested)
            implements BuilderInput.BuilderAction, EncounterStatePublishedEvent.Mutation {
    }

    public record DetailSelectionInput(long creatureId) implements Input {
        public DetailSelectionInput {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record InitiativeInput(
            boolean backToBuilder,
            List<EncounterStateInitiativeEntry> initiatives
    ) implements Input, EncounterStatePublishedEvent.Mutation {
        public InitiativeInput {
            initiatives = EncounterStateInputCopies.initiatives(initiatives);
        }
    }

    public record CombatInput(CombatAction action) implements Input {
        public CombatInput {
            Objects.requireNonNull(action, "action");
        }

        public sealed interface CombatAction permits SimpleCombatAction, HpChangeAction, InitiativeEditAction,
                PartyMemberJoinAction {
        }
    }

    public record SimpleCombatAction(EncounterStateCombatSimpleAction action)
            implements CombatInput.CombatAction, EncounterStatePublishedEvent.Mutation {
        public SimpleCombatAction {
            action = EncounterStateCombatSimpleAction.fallback(action);
        }

        boolean endsCombatRequested() {
            return action.endsCombat();
        }
    }

    public record HpChangeAction(EncounterStateHpChange change)
            implements CombatInput.CombatAction, EncounterStatePublishedEvent.Mutation {
        public HpChangeAction {
            change = change == null ? new EncounterStateHpChange("", 0, false) : change;
        }
    }

    public record InitiativeEditAction(EncounterStateInitiativeAdjustment change)
            implements CombatInput.CombatAction, EncounterStatePublishedEvent.Mutation {
        public InitiativeEditAction {
            change = change == null ? new EncounterStateInitiativeAdjustment("", 0) : change;
        }
    }

    public record PartyMemberJoinAction(EncounterStatePartyMemberJoin change)
            implements CombatInput.CombatAction, EncounterStatePublishedEvent.Mutation {
        public PartyMemberJoinAction {
            change = change == null ? new EncounterStatePartyMemberJoin(0L, 0) : change;
        }
    }

    public record ResultInput(EncounterStateResultAction action) implements Input, EncounterStatePublishedEvent.Mutation {
        public ResultInput {
            action = EncounterStateResultAction.fallback(action);
        }
    }
}
