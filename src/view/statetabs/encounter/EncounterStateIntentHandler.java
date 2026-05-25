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
                    apply(ApplyEncounterStateCommand.action("GENERATE"));
            case EncounterBuilderStateViewInputEvent.ShiftAlternativeInput shift ->
                    apply(ApplyEncounterStateCommand.delta("SHIFT_ALTERNATIVE", shift.alternativeShift()));
            case EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput ignored ->
                    apply(ApplyEncounterStateCommand.action("SAVE_CURRENT_PLAN"));
            case EncounterBuilderStateViewInputEvent.OpenSavedPlanInput openPlan ->
                    apply(ApplyEncounterStateCommand.plan("OPEN_SAVED_PLAN", openPlan.selectedPlanId()));
            case EncounterBuilderStateViewInputEvent.ChangeRosterCountInput rosterChange -> {
                if (rosterChange.delta() > 0) {
                    apply(ApplyEncounterStateCommand.creature("INCREMENT_CREATURE", rosterChange.creatureId()));
                } else {
                    apply(ApplyEncounterStateCommand.creature("DECREMENT_CREATURE", rosterChange.creatureId()));
                }
            }
            case EncounterBuilderStateViewInputEvent.RemoveCreatureInput removal ->
                    apply(ApplyEncounterStateCommand.creature("REMOVE_CREATURE", removal.creatureId()));
            case EncounterBuilderStateViewInputEvent.UndoRemoveInput undo ->
                    apply(ApplyEncounterStateCommand.undo("UNDO_REMOVE", undo.undoToken()));
            case EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput ignored ->
                    apply(ApplyEncounterStateCommand.action("CLEAR_GENERATION_HISTORY"));
            case EncounterBuilderStateViewInputEvent.OpenInitiativeInput ignored ->
                    apply(ApplyEncounterStateCommand.action("OPEN_INITIATIVE"));
            case EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput detail ->
                    openCreatureDetail(detail.creatureId());
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backToBuilder()) {
            apply(ApplyEncounterStateCommand.action("BACK_TO_BUILDER"));
            return;
        }
        InitiativePayload payload = InitiativePayload.from(event.initiatives());
        apply(ApplyEncounterStateCommand.initiatives(
                "CONFIRM_INITIATIVE",
                payload.ids(),
                payload.numbers()));
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.combatInput()) {
            case EncounterCombatStateViewInputEvent.AdvanceTurnInput ignored ->
                    apply(ApplyEncounterStateCommand.action("ADVANCE_TURN"));
            case EncounterCombatStateViewInputEvent.EndCombatInput ignored ->
                    apply(ApplyEncounterStateCommand.action("END_COMBAT"));
            case EncounterCombatStateViewInputEvent.HpChangeInput hp ->
                    apply(ApplyEncounterStateCommand.hitPoints(
                            "MUTATE_HP",
                            hp.combatantId(),
                            hp.amount(),
                            hp.healing()));
            case EncounterCombatStateViewInputEvent.InitiativeEditInput initiative ->
                    apply(ApplyEncounterStateCommand.initiative(
                            "ADJUST_INITIATIVE",
                            initiative.combatantId(),
                            initiative.initiativeValue()));
            case EncounterCombatStateViewInputEvent.PartyMemberJoinInput partyMember ->
                    apply(ApplyEncounterStateCommand.partyMember(
                            "ADD_PARTY_MEMBER_TO_COMBAT",
                            partyMember.partyMemberId(),
                            partyMember.initiativeValue()));
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
            apply(ApplyEncounterStateCommand.action("AWARD_XP"));
            return;
        }
        if (event.returnToBuilderRequested()) {
            apply(ApplyEncounterStateCommand.action("RETURN_TO_BUILDER_AFTER_RESULTS"));
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

    private record InitiativePayload(List<String> ids, List<Integer> numbers) {

        static InitiativePayload from(List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> entries) {
            List<String> nextIds = new ArrayList<>();
            List<Integer> nextNumbers = new ArrayList<>();
            for (EncounterInitiativeStateViewInputEvent.InitiativeEntry entry
                    : entries == null ? List.<EncounterInitiativeStateViewInputEvent.InitiativeEntry>of() : entries) {
                nextIds.add(entry.id());
                nextNumbers.add(entry.initiative());
            }
            return new InitiativePayload(List.copyOf(nextIds), List.copyOf(nextNumbers));
        }
    }
}
