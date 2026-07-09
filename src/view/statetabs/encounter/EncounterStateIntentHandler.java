package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.SetWorldNpcLifecycleStatusCommand;

final class EncounterStateIntentHandler {

    private static final long UNRESOLVED_ID = 0L;
    private static final CreatureDetailSink NO_CREATURE_DETAIL_SINK = creatureId -> { };

    private final EncounterStateContributionModel presentationModel;
    private final EncounterApplicationService encounters;
    private final WorldPlannerApplicationService worldPlanner;
    private final CreaturesApplicationService creatures;
    private final CreatureDetailSink creatureDetailSink;

    EncounterStateIntentHandler(
            EncounterStateContributionModel presentationModel,
            EncounterApplicationService encounters,
            WorldPlannerApplicationService worldPlanner,
            CreaturesApplicationService creatures,
            CreatureDetailSink creatureDetailSink
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.worldPlanner = worldPlanner;
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.creatureDetailSink = creatureDetailSink == null ? NO_CREATURE_DETAIL_SINK : creatureDetailSink;
    }

    void consume(EncounterBuilderStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.builderInput()) {
            case EncounterBuilderStateViewInputEvent.GenerateInput ignored ->
                    apply(ApplyEncounterStateCommand.generate());
            case EncounterBuilderStateViewInputEvent.ShiftAlternativeInput shift ->
                    apply(ApplyEncounterStateCommand.shiftAlternative(shift.alternativeShift()));
            case EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput ignored ->
                    apply(ApplyEncounterStateCommand.saveCurrentPlan());
            case EncounterBuilderStateViewInputEvent.OpenSavedPlanInput openPlan ->
                    apply(ApplyEncounterStateCommand.openSavedPlan(openPlan.selectedPlanId()));
            case EncounterBuilderStateViewInputEvent.ChangeRosterCountInput rosterChange -> {
                if (rosterChange.delta() > 0) {
                    apply(ApplyEncounterStateCommand.incrementCreature(rosterChange.creatureId()));
                } else {
                    apply(ApplyEncounterStateCommand.decrementCreature(rosterChange.creatureId()));
                }
            }
            case EncounterBuilderStateViewInputEvent.RemoveCreatureInput removal ->
                    apply(ApplyEncounterStateCommand.removeCreature(removal.creatureId()));
            case EncounterBuilderStateViewInputEvent.UndoRemoveInput undo ->
                    apply(ApplyEncounterStateCommand.undoRemove(undo.undoToken()));
            case EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput ignored ->
                    apply(ApplyEncounterStateCommand.clearGenerationHistory());
            case EncounterBuilderStateViewInputEvent.OpenInitiativeInput ignored ->
                    apply(ApplyEncounterStateCommand.openInitiative());
            case EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput detail ->
                    openCreatureDetail(detail.creatureId());
        }
    }

    void consume(EncounterInitiativeStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.backToBuilder()) {
            apply(ApplyEncounterStateCommand.backToBuilder());
            return;
        }
        InitiativePayload payload = InitiativePayload.from(event.initiatives());
        apply(ApplyEncounterStateCommand.confirmInitiative(payload.ids(), payload.numbers()));
    }

    void consume(EncounterCombatStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.combatInput()) {
            case EncounterCombatStateViewInputEvent.AdvanceTurnInput ignored ->
                    apply(ApplyEncounterStateCommand.advanceTurn());
            case EncounterCombatStateViewInputEvent.EndCombatInput ignored ->
                    apply(ApplyEncounterStateCommand.endCombat());
            case EncounterCombatStateViewInputEvent.HpChangeInput hp ->
                    apply(ApplyEncounterStateCommand.mutateHitPoints(
                            hp.combatantId(),
                            hp.amount(),
                            hp.healing()));
            case EncounterCombatStateViewInputEvent.InitiativeEditInput initiative ->
                    apply(ApplyEncounterStateCommand.adjustInitiative(
                            initiative.combatantId(),
                            initiative.initiativeValue()));
            case EncounterCombatStateViewInputEvent.PartyMemberJoinInput partyMember ->
                    apply(ApplyEncounterStateCommand.addPartyMemberToCombat(
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
            apply(ApplyEncounterStateCommand.awardXp());
            return;
        }
        if (event.returnToBuilderRequested()) {
            markSelectedWorldNpcsDefeated(presentationModel.contentModels().results()
                    .selectedWorldNpcDefeats(event.selectedEnemies()));
            apply(ApplyEncounterStateCommand.returnToBuilderAfterResults());
        }
    }

    private void markSelectedWorldNpcsDefeated(
            List<EncounterResultsStateContentModel.WorldNpcDefeatView> worldNpcIds
    ) {
        if (worldPlanner == null) {
            return;
        }
        for (EncounterResultsStateContentModel.WorldNpcDefeatView worldNpc : worldNpcIds == null
                ? List.<EncounterResultsStateContentModel.WorldNpcDefeatView>of()
                : worldNpcIds) {
            if (worldNpc != null && worldNpc.worldNpcId() > UNRESOLVED_ID) {
                worldPlanner.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.defeated(
                        worldNpc.worldNpcId(),
                        worldNpc.expectedCreatureStatblockId()));
            }
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
