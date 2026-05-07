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
        SessionPlannerControlsViewInputEvent.Interaction interaction = event.interaction();
        if (interaction instanceof SessionPlannerControlsViewInputEvent.CreateSessionInput) {
            publish(new SessionPlannerPublishedEvent(new SessionPlannerPublishedEvent.CreateSessionMutation()));
            return;
        }
        if (interaction instanceof SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant) {
            if (addParticipant.characterId() > 0L) {
                publish(new SessionPlannerPublishedEvent(
                        new SessionPlannerPublishedEvent.AddParticipantMutation(addParticipant.characterId())));
            }
            return;
        }
        if (interaction instanceof SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant) {
            if (removeParticipant.characterId() > 0L) {
                publish(new SessionPlannerPublishedEvent(
                        new SessionPlannerPublishedEvent.RemoveParticipantMutation(removeParticipant.characterId())));
            }
            return;
        }
        if (interaction instanceof SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput) {
            BigDecimal encounterDays = parsePositiveDecimal(encounterDaysInput.encounterDaysText());
            if (encounterDays != null) {
                publish(new SessionPlannerPublishedEvent(
                        new SessionPlannerPublishedEvent.SetEncounterDaysMutation(encounterDays)));
            }
            return;
        }
        if (interaction instanceof SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan
                && attachPlan.selectedPlanId() > 0L) {
            publish(new SessionPlannerPublishedEvent(
                    new SessionPlannerPublishedEvent.AttachPlanMutation(attachPlan.selectedPlanId())));
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        SessionPlannerTimelineMainViewInputEvent.Interaction interaction = event.interaction();
        if (interaction instanceof SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selection) {
            publishSelectEncounter(selection.encounterToken());
            return;
        }
        if (interaction instanceof SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation) {
            publishAllocationChange(allocation.encounterToken(), allocation.targetAllocationPercentage());
            return;
        }
        if (interaction instanceof SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput move) {
            publishEncounterMove(move.encounterToken(), move.direction());
            return;
        }
        if (interaction instanceof SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removal) {
            publishRemoveEncounter(removal.encounterToken());
            return;
        }
        if (interaction instanceof SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap) {
            publishRestGap(restGap.leftEncounterId(), restGap.rightEncounterId(), restGap.restSelection());
        }
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.interaction() instanceof SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot) {
            if (removeLoot.lootToken() > 0L) {
                publish(new SessionPlannerPublishedEvent(
                        new SessionPlannerPublishedEvent.RemoveLootPlaceholderMutation(removeLoot.lootToken())));
            }
            return;
        }
        if (event.interaction() instanceof SessionPlannerLootMainViewInputEvent.AddLootPlaceholderInput) {
            publish(new SessionPlannerPublishedEvent(new SessionPlannerPublishedEvent.AddLootPlaceholderMutation()));
        }
    }

    private void publishSelectEncounter(long encounterToken) {
        if (encounterToken > 0L) {
            publish(new SessionPlannerPublishedEvent(
                    new SessionPlannerPublishedEvent.SelectEncounterMutation(encounterToken)));
        }
    }

    private void publishAllocationChange(long encounterToken, BigDecimal delta) {
        if (encounterToken <= 0L || delta == null) {
            return;
        }
        publish(new SessionPlannerPublishedEvent(
                new SessionPlannerPublishedEvent.SetEncounterAllocationMutation(encounterToken, delta)));
    }

    private void publishEncounterMove(
            long encounterToken,
            SessionPlannerTimelineMainViewInputEvent.Direction direction
    ) {
        if (encounterToken <= 0L) {
            return;
        }
        SessionPlannerPublishedEvent.Direction publishedDirection =
                direction == SessionPlannerTimelineMainViewInputEvent.Direction.DOWN
                        ? SessionPlannerPublishedEvent.Direction.DOWN
                        : SessionPlannerPublishedEvent.Direction.UP;
        publish(new SessionPlannerPublishedEvent(
                new SessionPlannerPublishedEvent.MoveEncounterMutation(encounterToken, publishedDirection)));
    }

    private void publishRemoveEncounter(long encounterToken) {
        if (encounterToken > 0L) {
            publish(new SessionPlannerPublishedEvent(
                    new SessionPlannerPublishedEvent.RemoveEncounterMutation(encounterToken)));
        }
    }

    private void publishRestGap(
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerTimelineMainViewInputEvent.RestSelection selection
    ) {
        if (!isResolvedGap(leftEncounterId, rightEncounterId)) {
            return;
        }
        if (selection == null || selection == SessionPlannerTimelineMainViewInputEvent.RestSelection.NONE) {
            publish(new SessionPlannerPublishedEvent(
                    new SessionPlannerPublishedEvent.ClearRestGapMutation(leftEncounterId, rightEncounterId)));
            return;
        }
        SessionPlannerPublishedEvent.RestSelection publishedSelection =
                selection == SessionPlannerTimelineMainViewInputEvent.RestSelection.LONG_REST
                        ? SessionPlannerPublishedEvent.RestSelection.LONG_REST
                        : SessionPlannerPublishedEvent.RestSelection.SHORT_REST;
        publish(new SessionPlannerPublishedEvent(
                new SessionPlannerPublishedEvent.SetRestGapMutation(
                        leftEncounterId,
                        rightEncounterId,
                        publishedSelection)));
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
