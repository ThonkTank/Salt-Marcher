package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
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
        switch (event.kind()) {
            case REFRESH -> publishedEventListener.accept(SessionPlannerPublishedEvent.refresh());
            case CREATE_SESSION -> publishedEventListener.accept(SessionPlannerPublishedEvent.createSession());
            case ADD_PARTICIPANT -> {
                if (event.characterId() > 0L) {
                    publishedEventListener.accept(SessionPlannerPublishedEvent.addParticipant(event.characterId()));
                }
            }
            case REMOVE_PARTICIPANT -> {
                if (event.characterId() > 0L) {
                    publishedEventListener.accept(SessionPlannerPublishedEvent.removeParticipant(event.characterId()));
                }
            }
            case SET_ENCOUNTER_DAYS -> {
                BigDecimal encounterDays = parsePositiveDecimal(event.encounterDaysText());
                if (encounterDays != null) {
                    publishedEventListener.accept(SessionPlannerPublishedEvent.setEncounterDays(encounterDays));
                }
            }
            case ATTACH_PLAN -> {
                if (event.selectedPlanId() > 0L) {
                    publishedEventListener.accept(SessionPlannerPublishedEvent.attachPlan(event.selectedPlanId()));
                }
            }
            default -> {
            }
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case SELECT_ENCOUNTER -> publishSelectEncounter(event.encounterToken());
            case SET_ENCOUNTER_ALLOCATION -> publishAllocationChange(
                    event.encounterToken(),
                    event.targetAllocationPercentage());
            case MOVE_ENCOUNTER_UP -> publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterUp(event.encounterToken()));
            case MOVE_ENCOUNTER_DOWN -> publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterDown(event.encounterToken()));
            case REMOVE_ENCOUNTER -> publishedEventListener.accept(SessionPlannerPublishedEvent.removeEncounter(event.encounterToken()));
            case SET_SHORT_REST -> publishRestGap(
                    event.leftEncounterId(),
                    event.rightEncounterId(),
                    SessionPlannerPublishedEvent.RestSelection.SHORT_REST);
            case SET_LONG_REST -> publishRestGap(
                    event.leftEncounterId(),
                    event.rightEncounterId(),
                    SessionPlannerPublishedEvent.RestSelection.LONG_REST);
            case CLEAR_REST -> publishClearRestGap(event.leftEncounterId(), event.rightEncounterId());
            default -> {
            }
        }
    }

    void consume(SessionPlannerLootMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.removedLootToken() > 0L) {
            publishedEventListener.accept(
                    SessionPlannerPublishedEvent.removeLootPlaceholder(event.removedLootToken()));
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.addLootPlaceholder());
    }

    private void publishSelectEncounter(long encounterToken) {
        if (encounterToken > 0L) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.selectEncounter(encounterToken));
        }
    }

    private void publishAllocationChange(long encounterToken, BigDecimal delta) {
        if (encounterToken <= 0L || delta == null) {
            return;
        }
        publishedEventListener.accept(SessionPlannerPublishedEvent.setEncounterAllocation(encounterToken, delta));
    }

    private void publishRestGap(
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerPublishedEvent.RestSelection selection
    ) {
        if (!isResolvedGap(leftEncounterId, rightEncounterId)) {
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.setRestGap(
                        leftEncounterId,
                        rightEncounterId,
                        selection));
    }

    private void publishClearRestGap(long leftEncounterId, long rightEncounterId) {
        if (!isResolvedGap(leftEncounterId, rightEncounterId)) {
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.clearRestGap(
                        leftEncounterId,
                        rightEncounterId));
    }

    private static boolean isResolvedGap(long leftEncounterId, long rightEncounterId) {
        return leftEncounterId > 0L && rightEncounterId > 0L;
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
