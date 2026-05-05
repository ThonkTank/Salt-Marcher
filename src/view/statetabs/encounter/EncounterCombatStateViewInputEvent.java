package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterCombatStateViewInputEvent(Interaction interaction) {

    public EncounterCombatStateViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits AdvanceTurnInteraction, HpChangeInteraction, InitiativeEditInteraction,
            PartyMemberJoinInteraction, EndCombatInteraction {
    }

    public record AdvanceTurnInteraction() implements Interaction {
    }

    public record HpChangeInteraction(String combatantId, int amount, boolean healing) implements Interaction {
        public HpChangeInteraction {
            combatantId = combatantId == null ? "" : combatantId;
            amount = Math.max(0, amount);
        }
    }

    public record InitiativeEditInteraction(String combatantId, int initiativeValue) implements Interaction {
        public InitiativeEditInteraction {
            combatantId = combatantId == null ? "" : combatantId;
        }
    }

    public record PartyMemberJoinInteraction(long partyMemberId, int initiativeValue) implements Interaction {
        public PartyMemberJoinInteraction {
            partyMemberId = Math.max(0L, partyMemberId);
        }
    }

    public record EndCombatInteraction() implements Interaction {
    }
}
