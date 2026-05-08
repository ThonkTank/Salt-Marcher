package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;

public record EncounterStatePublishedEvent(Mutation mutation) {

    public EncounterStatePublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits GenerateMutation, ShiftAlternativeMutation, SaveCurrentPlanMutation,
            OpenSavedPlanMutation, IncrementCreatureMutation, DecrementCreatureMutation, RemoveCreatureMutation,
            UndoRemoveMutation, ClearGenerationHistoryMutation, OpenInitiativeMutation, BackToBuilderMutation,
            ConfirmInitiativeMutation, AdvanceTurnMutation, EndCombatMutation, HpChangeMutation,
            InitiativeEditMutation, PartyMemberJoinMutation, AwardXpMutation, ReturnToBuilderMutation {
    }

    public record GenerateMutation() implements Mutation {
    }

    public record ShiftAlternativeMutation(int alternativeShift) implements Mutation {
    }

    public record SaveCurrentPlanMutation() implements Mutation {
    }

    public record OpenSavedPlanMutation(long selectedPlanId) implements Mutation {
        public OpenSavedPlanMutation {
            selectedPlanId = Math.max(0L, selectedPlanId);
        }
    }

    public record IncrementCreatureMutation(long creatureId) implements Mutation {
        public IncrementCreatureMutation {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record DecrementCreatureMutation(long creatureId) implements Mutation {
        public DecrementCreatureMutation {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record RemoveCreatureMutation(long creatureId) implements Mutation {
        public RemoveCreatureMutation {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record UndoRemoveMutation(long undoToken) implements Mutation {
        public UndoRemoveMutation {
            undoToken = Math.max(0L, undoToken);
        }
    }

    public record ClearGenerationHistoryMutation() implements Mutation {
    }

    public record OpenInitiativeMutation() implements Mutation {
    }

    public record BackToBuilderMutation() implements Mutation {
    }

    public record ConfirmInitiativeMutation(List<InitiativeValue> initiatives) implements Mutation {
        public ConfirmInitiativeMutation {
            initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        }
    }

    public record InitiativeValue(String id, int initiative) {
        public InitiativeValue {
            id = id == null ? "" : id;
        }
    }

    public record AdvanceTurnMutation() implements Mutation {
    }

    public record EndCombatMutation() implements Mutation {
    }

    public record HpChangeMutation(
            String combatantId,
            int amount,
            boolean healing
    ) implements Mutation {
        public HpChangeMutation {
            combatantId = combatantId == null ? "" : combatantId;
            amount = Math.max(0, amount);
        }
    }

    public record InitiativeEditMutation(
            String combatantId,
            int initiativeValue
    ) implements Mutation {
        public InitiativeEditMutation {
            combatantId = combatantId == null ? "" : combatantId;
        }
    }

    public record PartyMemberJoinMutation(
            long partyMemberId,
            int initiativeValue
    ) implements Mutation {
        public PartyMemberJoinMutation {
            partyMemberId = Math.max(0L, partyMemberId);
        }
    }

    public record AwardXpMutation() implements Mutation {
    }

    public record ReturnToBuilderMutation() implements Mutation {
    }
}
