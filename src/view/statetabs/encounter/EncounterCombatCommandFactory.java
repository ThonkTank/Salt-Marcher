package src.view.statetabs.encounter;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.ApplyEncounterStateCommand;

final class EncounterCombatCommandFactory {

    private EncounterCombatCommandFactory() {
    }

    static @Nullable ApplyEncounterStateCommand fromInitiativeMutation(EncounterStatePublishedEvent.Mutation mutation) {
        if (!(mutation instanceof EncounterStateViewInputEvent.InitiativeInput submission)) {
            return null;
        }
        return submission.backToBuilder()
                ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.BACK_TO_BUILDER)
                : new ApplyEncounterStateCommand(
                        ApplyEncounterStateCommand.Action.CONFIRM_INITIATIVE,
                        0L,
                        0L,
                        0,
                        0L,
                        submission.initiatives().stream()
                                .map(entry -> new ApplyEncounterStateCommand.InitiativeValue(entry.id(), entry.initiative()))
                                .toList(),
                        "",
                        0,
                        0L,
                        0,
                        false);
    }

    static @Nullable ApplyEncounterStateCommand fromCombatMutation(EncounterStatePublishedEvent.Mutation mutation) {
        return switch (mutation) {
            case EncounterStateViewInputEvent.SimpleCombatAction simpleAction -> simpleAction.endsCombatRequested()
                    ? EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.END_COMBAT)
                    : EncounterStateCommandFactory.command(ApplyEncounterStateCommand.Action.ADVANCE_TURN);
            case EncounterStateViewInputEvent.HpChangeAction hp -> new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.MUTATE_HP,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    hp.change().combatantId(),
                    0,
                    0L,
                    hp.change().amount(),
                    hp.change().healing());
            case EncounterStateViewInputEvent.InitiativeEditAction initiative -> new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADJUST_INITIATIVE,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    initiative.change().combatantId(),
                    initiative.change().initiativeValue(),
                    0L,
                    0,
                    false);
            case EncounterStateViewInputEvent.PartyMemberJoinAction partyMember -> new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    partyMember.change().initiativeValue(),
                    partyMember.change().partyMemberId(),
                    0,
                    false);
            default -> null;
        };
    }
}
