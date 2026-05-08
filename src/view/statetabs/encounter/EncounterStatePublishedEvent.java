package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;

public record EncounterStatePublishedEvent(Mutation mutation) {

    public EncounterStatePublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits BuilderMutation, InitiativeMutation, CombatMutation, ResultMutation {
    }

    public enum BuilderChange {
        GENERATE,
        SHIFT_ALTERNATIVE,
        SAVE_CURRENT_PLAN,
        OPEN_SAVED_PLAN,
        INCREMENT_CREATURE,
        DECREMENT_CREATURE,
        REMOVE_CREATURE,
        UNDO_REMOVE,
        CLEAR_GENERATION_HISTORY,
        OPEN_INITIATIVE
    }

    public record BuilderMutation(
            BuilderChange change,
            long referenceId,
            int delta
    ) implements Mutation {
        public BuilderMutation {
            Objects.requireNonNull(change, "change");
            referenceId = Math.max(0L, referenceId);
        }
    }

    public record InitiativeMutation(
            boolean returnToBuilder,
            List<SubmittedInitiative> submissions
    ) implements Mutation {
        public InitiativeMutation {
            submissions = submissions == null ? List.of() : List.copyOf(submissions);
        }
    }

    public record SubmittedInitiative(
            String combatantId,
            int rolledInitiative
    ) {
        public SubmittedInitiative {
            combatantId = combatantId == null ? "" : combatantId;
        }
    }

    public enum CombatChange {
        ADVANCE_TURN,
        END_COMBAT,
        MUTATE_HP,
        ADJUST_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT
    }

    public record CombatMutation(
            CombatChange change,
            String combatantId,
            int numericValue,
            long partyMemberId,
            boolean healing
    ) implements Mutation {
        public CombatMutation {
            Objects.requireNonNull(change, "change");
            combatantId = combatantId == null ? "" : combatantId;
            numericValue = Math.max(0, numericValue);
            partyMemberId = Math.max(0L, partyMemberId);
        }
    }

    public record ResultMutation(boolean awardExperience) implements Mutation {
    }
}
