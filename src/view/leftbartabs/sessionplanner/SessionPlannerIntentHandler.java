package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AddSessionParticipantCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.CreateSessionPlanCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterDownCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterUpCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.RemoveSessionParticipantCommand;
import src.domain.sessionplanner.published.SelectSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
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
                    planner.createSession(new CreateSessionPlanCommand());
            case SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant -> {
                if (hasPositiveId(addParticipant.participantToAddId())) {
                    planner.addParticipant(new AddSessionParticipantCommand(addParticipant.participantToAddId()));
                }
            }
            case SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant -> {
                if (hasPositiveId(removeParticipant.participantToRemoveId())) {
                    planner.removeParticipant(new RemoveSessionParticipantCommand(
                            removeParticipant.participantToRemoveId()));
                }
            }
            case SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput -> {
                BigDecimal encounterDays = parsePositiveDecimal(encounterDaysInput.encounterDaysText());
                if (encounterDays != null) {
                    planner.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays));
                }
            }
            case SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan -> {
                if (hasPositiveId(attachPlan.planIdToAttach())) {
                    planner.attachEncounter(new AttachSessionEncounterCommand(attachPlan.planIdToAttach()));
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
                    planner.selectEncounter(new SelectSessionEncounterCommand(selection.selectedEncounterToken()));
                }
            }
            case SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation -> {
                if (hasPositiveId(allocation.encounterToken())) {
                    planner.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
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
                    planner.removeEncounter(new RemoveSessionEncounterCommand(removal.encounterTokenToRemove()));
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
                    planner.addLootPlaceholder(new AddSessionLootPlaceholderCommand());
            case SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot -> {
                if (hasPositiveId(removeLoot.lootToken())) {
                    planner.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(removeLoot.lootToken()));
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
            planner.moveEncounterDown(new MoveSessionEncounterDownCommand(moveEncounter.encounterToken()));
            return;
        }
        planner.moveEncounterUp(new MoveSessionEncounterUpCommand(moveEncounter.encounterToken()));
    }

    private void applyRestGap(SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap) {
        if (restGap.clearsRestGap()) {
            planner.clearRestGap(new ClearSessionRestGapCommand(
                    restGap.leftEncounterId(),
                    restGap.rightEncounterId()));
            return;
        }
        planner.setRestGap(new SetSessionRestGapCommand(
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
