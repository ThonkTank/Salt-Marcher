package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterCombatStateViewInputEvent(Interaction combatInput) {

    public EncounterCombatStateViewInputEvent {
        Objects.requireNonNull(combatInput, "combatInput");
    }

    public sealed interface Interaction permits AdvanceTurnInput, EndCombatInput, HpChangeInput,
            InitiativeEditInput, PartyMemberJoinInput {
    }

    public static final class AdvanceTurnInput implements Interaction {
    }

    public static final class EndCombatInput implements Interaction {
    }

    public record HpChangeInput(
            String combatantId,
            int amount,
            boolean healing
    ) implements Interaction {
        public HpChangeInput {
            combatantId = combatantId == null ? "" : combatantId;
            amount = Math.max(0, amount);
        }
    }

    public record InitiativeEditInput(
            String combatantId,
            int initiativeValue
    ) implements Interaction {
        public InitiativeEditInput {
            combatantId = combatantId == null ? "" : combatantId;
        }
    }

    public record PartyMemberJoinInput(
            long partyMemberId,
            int initiativeValue
    ) implements Interaction {
        public PartyMemberJoinInput {
            partyMemberId = Math.max(0L, partyMemberId);
        }
    }
}
