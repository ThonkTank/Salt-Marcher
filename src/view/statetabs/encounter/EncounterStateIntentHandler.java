package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;

final class EncounterStateIntentHandler {

    private static final long UNRESOLVED_ID = 0L;
    private static final CreatureDetailSink NO_CREATURE_DETAIL_SINK = creatureId -> { };

    private final EncounterStateContributionModel presentationModel;
    private final EncounterApplicationService encounters;
    private final CreaturesApplicationService creatures;
    private final CreatureDetailSink creatureDetailSink;

    EncounterStateIntentHandler(
            EncounterStateContributionModel presentationModel,
            EncounterApplicationService encounters,
            CreaturesApplicationService creatures,
            CreatureDetailSink creatureDetailSink
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.creatureDetailSink = creatureDetailSink == null ? NO_CREATURE_DETAIL_SINK : creatureDetailSink;
    }

    void consume(EncounterBuilderStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.builderInput()) {
        case EncounterBuilderStateViewInputEvent.GenerateInput ignored ->
                    apply(command("GENERATE"));
            case EncounterBuilderStateViewInputEvent.ShiftAlternativeInput shift ->
                    apply(shiftAlternativeCommand(shift.alternativeShift()));
            case EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput ignored ->
                    apply(command("SAVE_CURRENT_PLAN"));
            case EncounterBuilderStateViewInputEvent.OpenSavedPlanInput openPlan ->
                    apply(openSavedPlanCommand(openPlan.selectedPlanId()));
            case EncounterBuilderStateViewInputEvent.ChangeRosterCountInput rosterChange -> {
                if (rosterChange.delta() > 0) {
                    apply(creatureCommand("INCREMENT_CREATURE", rosterChange.creatureId()));
                } else {
                    apply(creatureCommand("DECREMENT_CREATURE", rosterChange.creatureId()));
                }
            }
            case EncounterBuilderStateViewInputEvent.RemoveCreatureInput removal ->
                    apply(creatureCommand("REMOVE_CREATURE", removal.creatureId()));
            case EncounterBuilderStateViewInputEvent.UndoRemoveInput undo ->
                    apply(undoRemoveCommand(undo.undoToken()));
            case EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput ignored ->
                    apply(command("CLEAR_GENERATION_HISTORY"));
            case EncounterBuilderStateViewInputEvent.OpenInitiativeInput ignored ->
                    apply(command("OPEN_INITIATIVE"));
            case EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput detail ->
                    openCreatureDetail(detail.creatureId());
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backToBuilder()) {
            apply(command("BACK_TO_BUILDER"));
            return;
        }
        apply(confirmInitiativeCommand(event.initiatives()));
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.combatInput()) {
            case EncounterCombatStateViewInputEvent.AdvanceTurnInput ignored ->
                    apply(command("ADVANCE_TURN"));
            case EncounterCombatStateViewInputEvent.EndCombatInput ignored ->
                    apply(command("END_COMBAT"));
            case EncounterCombatStateViewInputEvent.HpChangeInput hp ->
                    apply(hitPointCommand(hp.combatantId(), hp.amount(), hp.healing()));
            case EncounterCombatStateViewInputEvent.InitiativeEditInput initiative ->
                    apply(adjustInitiativeCommand(initiative.combatantId(), initiative.initiativeValue()));
            case EncounterCombatStateViewInputEvent.PartyMemberJoinInput partyMember ->
                    apply(addPartyMemberCommand(partyMember.partyMemberId(), partyMember.initiativeValue()));
        }
    }

    void consume(EncounterResultsStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        presentationModel.contentModels().results().showSelection(
                event.selectedEnemies(),
                event.thresholdFraction(),
                event.xpFraction());
        if (event.awardExperienceRequested()) {
            apply(command("AWARD_XP"));
            return;
        }
        if (event.returnToBuilderRequested()) {
            apply(command("RETURN_TO_BUILDER_AFTER_RESULTS"));
        }
    }

    private void openCreatureDetail(long creatureId) {
        if (creatureId <= UNRESOLVED_ID) {
            return;
        }
        creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        creatureDetailSink.openCreatureDetail(creatureId);
    }

    @FunctionalInterface
    interface CreatureDetailSink {
        void openCreatureDetail(long creatureId);
    }

    private void apply(ApplyEncounterStateCommand command) {
        encounters.applyState(Objects.requireNonNull(command, "command"));
    }

    private static ApplyEncounterStateCommand command(String action) {
        return ApplyEncounterStateCommand.action(action);
    }

    private static ApplyEncounterStateCommand shiftAlternativeCommand(int delta) {
        return ApplyEncounterStateCommand.delta("SHIFT_ALTERNATIVE", delta);
    }

    private static ApplyEncounterStateCommand openSavedPlanCommand(long planId) {
        return ApplyEncounterStateCommand.plan("OPEN_SAVED_PLAN", planId);
    }

    private static ApplyEncounterStateCommand creatureCommand(String action, long creatureId) {
        return ApplyEncounterStateCommand.creature(action, creatureId);
    }

    private static ApplyEncounterStateCommand undoRemoveCommand(long undoToken) {
        return ApplyEncounterStateCommand.undo("UNDO_REMOVE", undoToken);
    }

    private static ApplyEncounterStateCommand confirmInitiativeCommand(
            List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> initiatives
    ) {
        return ApplyEncounterStateCommand.initiatives(
                "CONFIRM_INITIATIVE",
                initiativeIds(initiatives),
                initiativeNumbers(initiatives));
    }

    private static ApplyEncounterStateCommand hitPointCommand(String combatantId, int amount, boolean healing) {
        return ApplyEncounterStateCommand.hitPoints("MUTATE_HP", combatantId, amount, healing);
    }

    private static ApplyEncounterStateCommand adjustInitiativeCommand(String combatantId, int initiativeValue) {
        return ApplyEncounterStateCommand.initiative("ADJUST_INITIATIVE", combatantId, initiativeValue);
    }

    private static ApplyEncounterStateCommand addPartyMemberCommand(long partyMemberId, int initiativeValue) {
        return ApplyEncounterStateCommand.partyMember("ADD_PARTY_MEMBER_TO_COMBAT", partyMemberId, initiativeValue);
    }

    private static List<String> initiativeIds(
            List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> entries
    ) {
        List<String> values = new ArrayList<>();
        for (EncounterInitiativeStateViewInputEvent.InitiativeEntry entry : safeInitiativeEntries(entries)) {
            values.add(entry.id());
        }
        return List.copyOf(values);
    }

    private static List<Integer> initiativeNumbers(
            List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> entries
    ) {
        List<Integer> values = new ArrayList<>();
        for (EncounterInitiativeStateViewInputEvent.InitiativeEntry entry : safeInitiativeEntries(entries)) {
            values.add(entry.initiative());
        }
        return List.copyOf(values);
    }

    private static List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> safeInitiativeEntries(
            List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> entries
    ) {
        return entries == null ? List.of() : entries;
    }
}
