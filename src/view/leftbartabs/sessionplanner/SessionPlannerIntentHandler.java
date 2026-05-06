package src.view.leftbartabs.sessionplanner;

import java.util.function.Consumer;
import java.util.function.IntFunction;

final class SessionPlannerIntentHandler {

    private Consumer<SessionPlannerPublishedEvent> publishedEventListener = ignored -> { };
    private IntFunction<SessionPlannerContributionModel.RestGapModel> restGapResolver = ignored -> unresolvedGap();

    void onPublishedEventRequested(Consumer<SessionPlannerPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void onRestGapResolutionRequested(IntFunction<SessionPlannerContributionModel.RestGapModel> resolver) {
        restGapResolver = resolver == null ? ignored -> unresolvedGap() : resolver;
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.importRequested()) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.importPlan(event.selectedPlanId()));
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.removeEncounterRequested()) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.removeEncounter(event.encounterToken()));
            return;
        }
        if (event.encounterMoveDelta() < 0) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterUp(event.encounterToken()));
            return;
        }
        if (event.encounterMoveDelta() > 0) {
            publishedEventListener.accept(SessionPlannerPublishedEvent.moveEncounterDown(event.encounterToken()));
            return;
        }
        if (event.shortRestRequested()) {
            publishRestGap(event.gapIndex(), SessionPlannerPublishedEvent.RestSelection.SHORT_REST);
            return;
        }
        if (event.longRestRequested()) {
            publishRestGap(event.gapIndex(), SessionPlannerPublishedEvent.RestSelection.LONG_REST);
            return;
        }
        if (event.clearRestRequested()) {
            SessionPlannerContributionModel.RestGapModel gap = restGapResolver.apply(event.gapIndex());
            if (isResolvedGap(gap)) {
                publishedEventListener.accept(
                        SessionPlannerPublishedEvent.clearRestGap(
                                gap.leftEncounterId(),
                                gap.rightEncounterId()));
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

    private void publishRestGap(int gapIndex, SessionPlannerPublishedEvent.RestSelection selection) {
        SessionPlannerContributionModel.RestGapModel gap = restGapResolver.apply(gapIndex);
        if (!isResolvedGap(gap)) {
            return;
        }
        publishedEventListener.accept(
                SessionPlannerPublishedEvent.setRestGap(
                        gap.leftEncounterId(),
                        gap.rightEncounterId(),
                        selection));
    }

    private static boolean isResolvedGap(SessionPlannerContributionModel.RestGapModel gap) {
        return gap.leftEncounterId() > 0L && gap.rightEncounterId() > 0L;
    }

    private static SessionPlannerContributionModel.RestGapModel unresolvedGap() {
        return new SessionPlannerContributionModel.RestGapModel(-1, 0L, 0L, "", false);
    }
}
