package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.SessionPlannerApplicationService;
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

    SessionPlannerIntentHandler(SessionPlannerApplicationService planner) {
        this.planner = Objects.requireNonNull(planner, "planner");
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.controlsInput()) {
            case SessionPlannerControlsViewInputEvent.CreateSessionTrigger ignored ->
                    planner.apply(new SessionPlannerActionCommand(
                            SessionPlannerActionCommand.Action.CREATE_SESSION));
            case SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant -> {
                if (hasPositiveId(addParticipant.participantToAddId())) {
                    planner.apply(new SessionPlannerParticipantCommand(
                            SessionPlannerParticipantCommand.Action.ADD,
                            addParticipant.participantToAddId()));
                }
            }
            case SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant -> {
                if (hasPositiveId(removeParticipant.participantToRemoveId())) {
                    planner.apply(new SessionPlannerParticipantCommand(
                            SessionPlannerParticipantCommand.Action.REMOVE,
                            removeParticipant.participantToRemoveId()));
                }
            }
            case SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput -> {
                BigDecimal encounterDays = parsePositiveDecimal(encounterDaysInput.encounterDaysText());
                if (encounterDays != null) {
                    planner.apply(new SetSessionEncounterDaysCommand(encounterDays));
                }
            }
            case SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan -> {
                if (hasPositiveId(attachPlan.planIdToAttach())) {
                    planner.apply(new AttachSessionEncounterCommand(attachPlan.planIdToAttach()));
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
                    planner.apply(new SessionPlannerEncounterCommand(
                            SessionPlannerEncounterCommand.Action.SELECT,
                            selection.selectedEncounterToken()));
                }
            }
            case SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation -> {
                if (hasPositiveId(allocation.encounterToken())) {
                    planner.apply(new SessionPlannerEncounterAllocationCommand(
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
                    planner.apply(new SessionPlannerEncounterCommand(
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
                    planner.apply(new SessionPlannerActionCommand(
                            SessionPlannerActionCommand.Action.ADD_LOOT_PLACEHOLDER));
            case SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot -> {
                if (hasPositiveId(removeLoot.lootToken())) {
                    planner.apply(new RemoveSessionLootPlaceholderCommand(removeLoot.lootToken()));
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
            planner.apply(new SessionPlannerEncounterCommand(
                    SessionPlannerEncounterCommand.Action.MOVE_DOWN,
                    moveEncounter.encounterToken()));
            return;
        }
        planner.apply(new SessionPlannerEncounterCommand(
                SessionPlannerEncounterCommand.Action.MOVE_UP,
                moveEncounter.encounterToken()));
    }

    private void applyRestGap(SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap) {
        if (restGap.clearsRestGap()) {
            planner.apply(new ClearSessionRestGapCommand(
                    restGap.leftEncounterId(),
                    restGap.rightEncounterId()));
            return;
        }
        planner.apply(new SetSessionRestGapCommand(
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
