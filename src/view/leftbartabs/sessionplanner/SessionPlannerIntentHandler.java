package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

final class SessionPlannerIntentHandler {

    private final SessionPlannerApplicationService planner;
    private final SessionPlannerParticipantApplicationService participants;
    private final SessionPlannerEncounterApplicationService encounters;
    private final SessionPlannerRestApplicationService rests;
    private final SessionPlannerLootApplicationService loot;

    SessionPlannerIntentHandler(
            SessionPlannerApplicationService planner,
            SessionPlannerParticipantApplicationService participants,
            SessionPlannerEncounterApplicationService encounters,
            SessionPlannerRestApplicationService rests,
            SessionPlannerLootApplicationService loot
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.participants = Objects.requireNonNull(participants, "participants");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.rests = Objects.requireNonNull(rests, "rests");
        this.loot = Objects.requireNonNull(loot, "loot");
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.controlsInput()) {
            case SessionPlannerControlsViewInputEvent.CreateSessionTrigger ignored ->
                    planner.createSession(new SessionPlannerActionCommand(
                            SessionPlannerActionCommand.Action.CREATE_SESSION));
            case SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant -> {
                if (hasPositiveId(addParticipant.participantToAddId())) {
                    participants.addParticipant(new SessionPlannerParticipantCommand(
                            SessionPlannerParticipantCommand.Action.ADD,
                            addParticipant.participantToAddId()));
                }
            }
            case SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant -> {
                if (hasPositiveId(removeParticipant.participantToRemoveId())) {
                    participants.removeParticipant(new SessionPlannerParticipantCommand(
                            SessionPlannerParticipantCommand.Action.REMOVE,
                            removeParticipant.participantToRemoveId()));
                }
            }
            case SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput -> {
                BigDecimal encounterDays = parsePositiveDecimal(encounterDaysInput.encounterDaysText());
                if (encounterDays != null) {
                    encounters.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays));
                }
            }
            case SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan -> {
                if (hasPositiveId(attachPlan.planIdToAttach())) {
                    encounters.attachEncounter(new AttachSessionEncounterCommand(attachPlan.planIdToAttach()));
                }
            }
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.timelineInput()) {
            case SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selection -> {
                if (hasPositiveId(selection.selectedEncounterToken())) {
                    encounters.selectEncounter(new SessionPlannerEncounterCommand(
                            SessionPlannerEncounterCommand.Action.SELECT,
                            selection.selectedEncounterToken()));
                }
            }
            case SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation -> {
                if (hasPositiveId(allocation.encounterToken())) {
                    encounters.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                            allocation.encounterToken(),
                            allocation.targetAllocationPercentage()));
                }
            }
            case SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput move -> {
                if (hasPositiveId(move.encounterToken())) {
                    applyMove(move);
                }
            }
            case SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removal -> {
                if (hasPositiveId(removal.encounterTokenToRemove())) {
                    encounters.removeEncounter(new SessionPlannerEncounterCommand(
                            SessionPlannerEncounterCommand.Action.REMOVE,
                            removal.encounterTokenToRemove()));
                }
            }
            case SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap -> {
                if (isResolvedGap(restGap.leftEncounterId(), restGap.rightEncounterId())) {
                    applyRestGap(restGap);
                }
            }
        }
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.lootInput()) {
            case SessionPlannerLootMainViewInputEvent.AddLootPlaceholderTrigger ignored ->
                    loot.addLootPlaceholder(new SessionPlannerActionCommand(
                            SessionPlannerActionCommand.Action.ADD_LOOT_PLACEHOLDER));
            case SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot -> {
                if (hasPositiveId(removeLoot.lootToken())) {
                    loot.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(removeLoot.lootToken()));
                }
            }
        }
    }

    private static boolean hasPositiveId(long id) {
        return id > 0L;
    }

    private static boolean isResolvedGap(long leftEncounterId, long rightEncounterId) {
        return hasPositiveId(leftEncounterId) && hasPositiveId(rightEncounterId);
    }

    private void applyMove(SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput moveEncounter) {
        if (moveEncounter.movesDown()) {
            encounters.moveEncounterDown(new SessionPlannerEncounterCommand(
                    SessionPlannerEncounterCommand.Action.MOVE_DOWN,
                    moveEncounter.encounterToken()));
            return;
        }
        encounters.moveEncounterUp(new SessionPlannerEncounterCommand(
                SessionPlannerEncounterCommand.Action.MOVE_UP,
                moveEncounter.encounterToken()));
    }

    private void applyRestGap(SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap) {
        if (restGap.clearsRestGap()) {
            rests.clearRestGap(new ClearSessionRestGapCommand(
                    restGap.leftEncounterId(),
                    restGap.rightEncounterId()));
            return;
        }
        rests.setRestGap(new SetSessionRestGapCommand(
                restGap.leftEncounterId(),
                restGap.rightEncounterId(),
                toRestKind(restGap.restSelection())));
    }

    private static @Nullable BigDecimal parsePositiveDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal parsed = new BigDecimal(raw.trim().replace(',', '.'));
            return parsed.signum() <= 0 ? null : parsed;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static SessionPlannerRestKind toRestKind(SessionPlannerTimelineMainViewInputEvent.RestSelection selection) {
        return switch (SessionPlannerTimelineMainViewInputEvent.RestSelection.normalized(selection)) {
            case NONE -> SessionPlannerRestKind.NONE;
            case SHORT_REST -> SessionPlannerRestKind.SHORT_REST;
            case LONG_REST -> SessionPlannerRestKind.LONG_REST;
        };
    }
}
