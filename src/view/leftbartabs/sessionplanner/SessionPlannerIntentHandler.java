package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class SessionPlannerIntentHandler {

    private Consumer<SessionPlannerPublishedEvent> publishedEventListener = ignored -> { };

    void onPublishedEventRequested(Consumer<SessionPlannerPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        publish(ControlsInputInterpreter.interpret(event));
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        publish(TimelineInputInterpreter.interpret(event));
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        publish(LootInputInterpreter.interpret(event));
    }

    private void publish(@Nullable SessionPlannerPublishedEvent event) {
        if (event == null) {
            return;
        }
        publishedEventListener.accept(Objects.requireNonNull(event, "event"));
    }

    private static boolean hasPositiveId(long id) {
        return id > 0L;
    }

    private static boolean isResolvedGap(long leftEncounterId, long rightEncounterId) {
        return hasPositiveId(leftEncounterId) && hasPositiveId(rightEncounterId);
    }

    private static final class ControlsInputInterpreter {
        private static @Nullable SessionPlannerPublishedEvent interpret(@Nullable SessionPlannerControlsViewInputEvent event) {
            if (event == null) {
                return null;
            }
            return interpret(event.controlsInput());
        }

        private static @Nullable SessionPlannerPublishedEvent interpret(
                SessionPlannerControlsViewInputEvent.ControlsInput controlsInput
        ) {
            return switch (controlsInput) {
                case SessionPlannerControlsViewInputEvent.CreateSessionTrigger createSessionTrigger ->
                        new SessionPlannerPublishedEvent(createSessionTrigger);
                case SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant ->
                        publishWhenValid(addParticipant, addParticipant.participantToAddId());
                case SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant ->
                        publishWhenValid(removeParticipant, removeParticipant.participantToRemoveId());
                case SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput ->
                        publishEncounterDays(encounterDaysInput);
                case SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan ->
                        publishWhenValid(attachPlan, attachPlan.planIdToAttach());
            };
        }

        private static @Nullable SessionPlannerPublishedEvent publishWhenValid(
                SessionPlannerPublishedEvent.Mutation mutation,
                long id
        ) {
            return hasPositiveId(id) ? new SessionPlannerPublishedEvent(mutation) : null;
        }

        private static @Nullable SessionPlannerPublishedEvent publishEncounterDays(
                SessionPlannerControlsViewInputEvent.SetEncounterDaysInput encounterDaysInput
        ) {
            BigDecimal encounterDays = parsePositiveDecimal(encounterDaysInput.encounterDaysText());
            return encounterDays == null
                    ? null
                    : new SessionPlannerPublishedEvent(new SessionPlannerPublishedEvent.SetEncounterDaysMutation(encounterDays));
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
    }

    private static final class TimelineInputInterpreter {
        private static @Nullable SessionPlannerPublishedEvent interpret(@Nullable SessionPlannerTimelineMainViewInputEvent event) {
            if (event == null) {
                return null;
            }
            return interpret(event.timelineInput());
        }

        private static @Nullable SessionPlannerPublishedEvent interpret(
                SessionPlannerTimelineMainViewInputEvent.TimelineInput timelineInput
        ) {
            return switch (timelineInput) {
                case SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selection ->
                        publishWhenValid(selection, selection.selectedEncounterToken());
                case SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation ->
                        publishWhenValid(allocation, allocation.encounterToken());
                case SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput move ->
                        publishWhenValid(move, move.encounterToken());
                case SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removal ->
                        publishWhenValid(removal, removal.encounterTokenToRemove());
                case SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap ->
                        isResolvedGap(restGap.leftEncounterId(), restGap.rightEncounterId())
                                ? new SessionPlannerPublishedEvent(restGap)
                                : null;
            };
        }

        private static @Nullable SessionPlannerPublishedEvent publishWhenValid(
                SessionPlannerPublishedEvent.Mutation mutation,
                long id
        ) {
            return hasPositiveId(id) ? new SessionPlannerPublishedEvent(mutation) : null;
        }
    }

    private static final class LootInputInterpreter {
        private static @Nullable SessionPlannerPublishedEvent interpret(@Nullable SessionPlannerLootMainViewInputEvent event) {
            if (event == null) {
                return null;
            }
            return switch (event.lootInput()) {
                case SessionPlannerLootMainViewInputEvent.AddLootPlaceholderTrigger addLoot ->
                        new SessionPlannerPublishedEvent(addLoot);
                case SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot ->
                        hasPositiveId(removeLoot.lootToken())
                                ? new SessionPlannerPublishedEvent(removeLoot)
                                : null;
            };
        }
    }
}
