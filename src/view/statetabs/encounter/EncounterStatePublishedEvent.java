package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;

public record EncounterStatePublishedEvent(Mutation mutation) {

    public EncounterStatePublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits BuilderMutation, InitiativeSubmission, CombatMutation, ResultMutation {
    }

    public record BuilderMutation(BuilderChange change) implements Mutation {
        public BuilderMutation {
            Objects.requireNonNull(change, "change");
        }

        public sealed interface BuilderChange permits GeneratorMutation, PlanMutation, RosterMutation, UndoMutation,
                BuilderActionMutation {
        }
    }

    public record GeneratorMutation(boolean generate, int alternativeShift) implements BuilderMutation.BuilderChange {
        public GeneratorMutation {
            if (!generate && alternativeShift == 0) {
                throw new IllegalArgumentException("GeneratorMutation requires generate or a non-zero alternativeShift.");
            }
        }
    }

    public record PlanMutation(boolean saveCurrentPlan, long selectedPlanId) implements BuilderMutation.BuilderChange {
        public PlanMutation {
            selectedPlanId = Math.max(0L, selectedPlanId);
            if (!saveCurrentPlan && selectedPlanId <= 0L) {
                throw new IllegalArgumentException("PlanMutation requires saveCurrentPlan or a selectedPlanId.");
            }
        }
    }

    public record RosterMutation(long creatureId, int delta, boolean removeCreature) implements BuilderMutation.BuilderChange {
        public RosterMutation {
            creatureId = Math.max(0L, creatureId);
            if (creatureId <= 0L || (delta == 0 && !removeCreature)) {
                throw new IllegalArgumentException("RosterMutation requires a creatureId and either delta or removeCreature.");
            }
        }
    }

    public record UndoMutation(long token) implements BuilderMutation.BuilderChange {
        public UndoMutation {
            token = Math.max(0L, token);
            if (token <= 0L) {
                throw new IllegalArgumentException("UndoMutation requires a positive token.");
            }
        }
    }

    public record BuilderActionMutation(boolean clearHistory, boolean startInitiative) implements BuilderMutation.BuilderChange {
        public BuilderActionMutation {
            if ((clearHistory ? 1 : 0) + (startInitiative ? 1 : 0) != 1) {
                throw new IllegalArgumentException("BuilderActionMutation requires exactly one active action.");
            }
        }
    }

    public record InitiativeSubmission(boolean backToBuilder, List<InitiativeEntry> initiatives) implements Mutation {
        public InitiativeSubmission {
            initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
            if (!backToBuilder && initiatives.isEmpty()) {
                throw new IllegalArgumentException("InitiativeSubmission requires backToBuilder or initiative values.");
            }
        }
    }

    public record InitiativeEntry(String id, int initiative) {
        public InitiativeEntry {
            id = id == null ? "" : id;
        }
    }

    public record CombatMutation(CombatChange change) implements Mutation {
        public CombatMutation {
            Objects.requireNonNull(change, "change");
        }

        public sealed interface CombatChange permits AdvanceTurnMutation, HpMutation, InitiativeAdjustment,
                PartyMemberAddition, EndCombatMutation {
        }
    }

    public record AdvanceTurnMutation() implements CombatMutation.CombatChange {
    }

    public record HpMutation(String combatantId, int amount, boolean healing) implements CombatMutation.CombatChange {
        public HpMutation {
            combatantId = combatantId == null ? "" : combatantId;
            amount = Math.max(0, amount);
            if (combatantId.isBlank() || amount <= 0) {
                throw new IllegalArgumentException("HpMutation requires a combatantId and a positive amount.");
            }
        }
    }

    public record InitiativeAdjustment(String combatantId, int initiativeValue) implements CombatMutation.CombatChange {
        public InitiativeAdjustment {
            combatantId = combatantId == null ? "" : combatantId;
            if (combatantId.isBlank()) {
                throw new IllegalArgumentException("InitiativeAdjustment requires a combatantId.");
            }
        }
    }

    public record PartyMemberAddition(long partyMemberId, int initiativeValue) implements CombatMutation.CombatChange {
        public PartyMemberAddition {
            partyMemberId = Math.max(0L, partyMemberId);
            if (partyMemberId <= 0L) {
                throw new IllegalArgumentException("PartyMemberAddition requires a positive partyMemberId.");
            }
        }
    }

    public record EndCombatMutation() implements CombatMutation.CombatChange {
    }

    public record ResultMutation(ResultChange change) implements Mutation {
        public ResultMutation {
            Objects.requireNonNull(change, "change");
        }

        public sealed interface ResultChange permits AwardXpMutation, ReturnToBuilderMutation {
        }
    }

    public record AwardXpMutation() implements ResultMutation.ResultChange {
    }

    public record ReturnToBuilderMutation() implements ResultMutation.ResultChange {
    }
}
