package src.view.leftbartabs.sessionplanner;

import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.ApplySessionPlannerCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterPlanRef;
import src.domain.sessionplanner.published.SessionPlannerEncounterRef;
import src.domain.sessionplanner.published.SessionPlannerLootRef;
import src.domain.sessionplanner.published.SessionPlannerParticipantRef;
import src.domain.sessionplanner.published.SessionPlannerRestGapChange;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;

final class SessionPlannerPublishedEventApplier {

    private SessionPlannerPublishedEventApplier() {
    }

    static void apply(
            SessionPlannerApplicationService planner,
            SessionPlannerPublishedEvent event
    ) {
        if (planner != null && event != null) {
            planner.apply(toCommand(event.mutation()));
        }
    }

    private static ApplySessionPlannerCommand toCommand(SessionPlannerPublishedEvent.Mutation mutation) {
        return switch (mutation) {
            case SessionPlannerViewInputEvent.SimpleActionInput simple -> simple.action().createsSession()
                    ? ApplySessionPlannerCommand.createSession()
                    : ApplySessionPlannerCommand.addLootPlaceholder();
            case SessionPlannerViewInputEvent.ParticipantInput participant -> participant.change().action().addsParticipant()
                    ? ApplySessionPlannerCommand.addParticipant(new SessionPlannerParticipantRef(participant.change().characterId()))
                    : ApplySessionPlannerCommand.removeParticipant(new SessionPlannerParticipantRef(participant.change().characterId()));
            case SessionPlannerPublishedEvent.SetEncounterDaysMutation encounterDays ->
                    ApplySessionPlannerCommand.encounterDays(new SetSessionEncounterDaysCommand(encounterDays.encounterDays()));
            case SessionPlannerViewInputEvent.AttachPlanInput attachPlan ->
                    ApplySessionPlannerCommand.attachEncounter(new SessionPlannerEncounterPlanRef(attachPlan.plan().planId()));
            case SessionPlannerViewInputEvent.EncounterActionInput encounter -> encounter.action().removesEncounter()
                    ? ApplySessionPlannerCommand.removeEncounter(new SessionPlannerEncounterRef(encounter.encounter().encounterId()))
                    : ApplySessionPlannerCommand.selectEncounter(new SessionPlannerEncounterRef(encounter.encounter().encounterId()));
            case SessionPlannerViewInputEvent.MoveEncounterInput moveEncounter -> moveEncounter.change().direction().movesDown()
                    ? ApplySessionPlannerCommand.moveEncounterDown(
                            new SessionPlannerEncounterRef(moveEncounter.change().encounter().encounterId()))
                    : ApplySessionPlannerCommand.moveEncounterUp(
                            new SessionPlannerEncounterRef(moveEncounter.change().encounter().encounterId()));
            case SessionPlannerViewInputEvent.EncounterAllocationInput allocation ->
                    ApplySessionPlannerCommand.allocation(new SessionPlannerEncounterAllocationCommand(
                            allocation.change().encounter().encounterId(),
                            allocation.change().budgetPercentage()));
            case SessionPlannerViewInputEvent.RestGapInput restGap -> ApplySessionPlannerCommand.restGap(new SessionPlannerRestGapChange(
                    restGap.change().gap().leftEncounterId(),
                    restGap.change().gap().rightEncounterId(),
                    SessionPlannerRestKind.valueOf(SessionPlannerRestSelection.fallback(restGap.change().restSelection()).name())));
            case SessionPlannerViewInputEvent.LootRemovalInput lootRemoval ->
                    ApplySessionPlannerCommand.removeLoot(new SessionPlannerLootRef(lootRemoval.loot().lootToken()));
            case null -> ApplySessionPlannerCommand.refresh();
        };
    }
}
