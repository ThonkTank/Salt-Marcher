package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterCombatStateViewInputEvent(Interaction interaction) {

    public EncounterCombatStateViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits AdvanceTurnInput, EndCombatInput, HpChangeInput,
            InitiativeEditInput, PartyMemberJoinInput {
    }

    public record AdvanceTurnInput() implements Interaction {
    }

    public record EndCombatInput() implements Interaction {
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
