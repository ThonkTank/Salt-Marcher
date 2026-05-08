package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.function.Consumer;

final class SessionPlannerIntentHandler {

    private Consumer<SessionPlannerPublishedEvent> publishedEventListener = ignored -> { };

    void onPublishedEventRequested(Consumer<SessionPlannerPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        SessionPlannerControlsViewInputEvent.ControlsInput controlsInput = event.controlsInput();
        if (controlsInput instanceof SessionPlannerControlsViewInputEvent.CreateSessionTrigger createSessionTrigger) {
            publish(new SessionPlannerPublishedEvent(createSessionTrigger));
            return;
        }
        if (controlsInput instanceof SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant) {
            if (addParticipant.participantToAddId() > 0L) {
                publish(new SessionPlannerPublishedEvent(addParticipant));
            }
            return;
        }
        if (controlsInput instanceof SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant) {
            if (removeParticipant.participantToRemoveId() > 0L) {
                publish(new SessionPlannerPublishedEvent(removeParticipant));
            }
            return;
        }
        if (controlsInput instanceof SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput) {
            BigDecimal encounterDays = parsePositiveDecimal(encounterDaysInput.encounterDaysText());
            if (encounterDays != null) {
                publish(new SessionPlannerPublishedEvent(
                        new SessionPlannerPublishedEvent.SetEncounterDaysMutation(encounterDays)));
            }
            return;
        }
        if (controlsInput instanceof SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan
                && attachPlan.planIdToAttach() > 0L) {
            publish(new SessionPlannerPublishedEvent(attachPlan));
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        SessionPlannerTimelineMainViewInputEvent.TimelineInput timelineInput = event.timelineInput();
        if (timelineInput instanceof SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selection) {
            publishSelectEncounter(selection);
            return;
        }
        if (timelineInput instanceof SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation) {
            publishAllocationChange(allocation);
            return;
        }
        if (timelineInput instanceof SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput move) {
            publishEncounterMove(move);
            return;
        }
        if (timelineInput instanceof SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removal) {
            publishRemoveEncounter(removal);
            return;
        }
        if (timelineInput instanceof SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap) {
            publishRestGap(restGap);
        }
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.lootInput() instanceof SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot) {
            if (removeLoot.lootToken() > 0L) {
                publish(new SessionPlannerPublishedEvent(removeLoot));
            }
            return;
        }
        if (event.lootInput() instanceof SessionPlannerLootMainViewInputEvent.AddLootPlaceholderTrigger addLoot) {
            publish(new SessionPlannerPublishedEvent(addLoot));
        }
    }

    private void publishSelectEncounter(SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selection) {
        if (selection.selectedEncounterToken() > 0L) {
            publish(new SessionPlannerPublishedEvent(selection));
        }
    }

    private void publishAllocationChange(SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation) {
        if (allocation.encounterToken() <= 0L || allocation.targetAllocationPercentage() == null) {
            return;
        }
        publish(new SessionPlannerPublishedEvent(allocation));
    }

    private void publishEncounterMove(SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput move) {
        if (move.encounterToken() <= 0L) {
            return;
        }
        publish(new SessionPlannerPublishedEvent(move));
    }

    private void publishRemoveEncounter(SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removal) {
        if (removal.encounterTokenToRemove() > 0L) {
            publish(new SessionPlannerPublishedEvent(removal));
        }
    }

    private void publishRestGap(SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap) {
        if (!isResolvedGap(restGap.leftEncounterId(), restGap.rightEncounterId())) {
            return;
        }
        publish(new SessionPlannerPublishedEvent(restGap));
    }

    private static boolean isResolvedGap(long leftEncounterId, long rightEncounterId) {
        return leftEncounterId > 0L && rightEncounterId > 0L;
    }

    private void publish(SessionPlannerPublishedEvent event) {
        publishedEventListener.accept(Objects.requireNonNull(event, "event"));
    }

    private static BigDecimal parsePositiveDecimal(String raw) {
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
}
