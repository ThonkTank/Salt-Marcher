package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Consumer;

final class SessionPlannerIntentHandler {

    private static final BigDecimal ALLOCATION_STEP = new BigDecimal("10");

    private Consumer<SessionPlannerPublishedEvent> publishedEventListener = ignored -> { };
    private List<SessionPlannerContributionModel.EncounterModel> encounters = List.of();
    private List<SessionPlannerContributionModel.RestGapModel> restGaps = List.of();

    void onPublishedEventRequested(Consumer<SessionPlannerPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void replaceEncounters(List<SessionPlannerContributionModel.EncounterModel> encounters) {
        this.encounters = encounters == null ? List.of() : List.copyOf(encounters);
    }

    void replaceRestGaps(List<SessionPlannerContributionModel.RestGapModel> restGaps) {
        this.restGaps = restGaps == null ? List.of() : List.copyOf(restGaps);
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
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case SELECT_ENCOUNTER -> publishSelectEncounter(event.encounterToken());
            case INCREASE_ALLOCATION -> publishAllocationChange(event.encounterToken(), ALLOCATION_STEP);
            case DECREASE_ALLOCATION -> publishAllocationChange(event.encounterToken(), ALLOCATION_STEP.negate());
            case MOVE_ENCOUNTER_UP -> publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterUp(event.encounterToken()));
            case MOVE_ENCOUNTER_DOWN -> publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterDown(event.encounterToken()));
            case REMOVE_ENCOUNTER -> publishedEventListener.accept(SessionPlannerPublishedEvent.removeEncounter(event.encounterToken()));
            case SET_SHORT_REST -> publishRestGap(event.gapIndex(), SessionPlannerPublishedEvent.RestSelection.SHORT_REST);
            case SET_LONG_REST -> publishRestGap(event.gapIndex(), SessionPlannerPublishedEvent.RestSelection.LONG_REST);
            case CLEAR_REST -> publishClearRestGap(event.gapIndex());
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
        SessionPlannerContributionModel.EncounterModel encounter = encounter(encounterToken);
        if (encounter == null) {
            return;
        }
        BigDecimal nextPercentage = encounter.budgetPercentage().add(delta);
        publishedEventListener.accept(SessionPlannerPublishedEvent.setEncounterAllocation(encounterToken, nextPercentage));
    }

    private void publishRestGap(int gapIndex, SessionPlannerPublishedEvent.RestSelection selection) {
        SessionPlannerContributionModel.RestGapModel gap = restGap(gapIndex);
        if (!isResolvedGap(gap)) {
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.setRestGap(
                        gap.leftEncounterId(),
                        gap.rightEncounterId(),
                        selection));
    }

    private void publishClearRestGap(int gapIndex) {
        SessionPlannerContributionModel.RestGapModel gap = restGap(gapIndex);
        if (!isResolvedGap(gap)) {
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.clearRestGap(
                        gap.leftEncounterId(),
                        gap.rightEncounterId()));
    }

    private SessionPlannerContributionModel.EncounterModel encounter(long encounterToken) {
        return encounters.stream()
                .filter(candidate -> candidate.token() == encounterToken)
                .findFirst()
                .orElse(null);
    }

    private SessionPlannerContributionModel.RestGapModel restGap(int gapIndex) {
        if (gapIndex < 0 || gapIndex >= restGaps.size()) {
            return unresolvedGap();
        }
        return restGaps.get(gapIndex);
    }

    private static boolean isResolvedGap(SessionPlannerContributionModel.RestGapModel gap) {
        return gap.leftEncounterId() > 0L && gap.rightEncounterId() > 0L;
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

    private static SessionPlannerContributionModel.RestGapModel unresolvedGap() {
        return new SessionPlannerContributionModel.RestGapModel(-1, 0L, 0L, "", false);
    }
}
