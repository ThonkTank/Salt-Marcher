package features.party.application;

import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyCompositionResult;
import features.party.api.ActivePartyFactsModel;
import features.party.api.ActivePartyFactsResult;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDayCalculationResult;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.AdventuringDayResult;
import features.party.api.MutationResult;
import features.party.api.MutationStatus;
import features.party.api.PartyMutationModel;
import features.party.api.PartySnapshotModel;
import features.party.api.PartySnapshotResult;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.domain.roster.PartyRoster;
import java.util.concurrent.atomic.AtomicLong;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class PartyPublishedState {

    private static final DiagnosticId PUBLICATION_CALLBACK_FAILURE =
            new DiagnosticId("party.publication-callback-failure");

    private final PublishedState<PartySnapshotResult> snapshot;
    private final PublishedState<ActivePartyResult> activeParty;
    private final PublishedState<ActivePartyCompositionResult> activeComposition;
    private final PublishedState<ActivePartyFactsResult> activePartyFacts;
    private final PublishedState<AdventuringDayResult> adventuringDaySummary;
    private final PublishedState<PartyTravelPositionsResult> travelPositions;
    private final PublishedState<MutationResult> mutation;
    private final PublishedState<AdventuringDayCalculationResult> adventuringDayCalculation;
    private final AtomicLong travelPositionRevision = new AtomicLong();
    private final AtomicLong activePartyFactsRevision = new AtomicLong();
    private final PartySnapshotModel snapshotModel;
    private final ActivePartyModel activePartyModel;
    private final ActivePartyCompositionModel activeCompositionModel;
    private final ActivePartyFactsModel activePartyFactsModel;
    private final AdventuringDaySummaryModel adventuringDaySummaryModel;
    private final PartyTravelPositionsModel travelPositionsModel;
    private final PartyMutationModel mutationModel;
    private final AdventuringDayCalculationModel adventuringDayCalculationModel;

    public PartyPublishedState(UiDispatcher dispatcher) {
        this(dispatcher, NoopDiagnostics.INSTANCE);
    }

    public PartyPublishedState(UiDispatcher dispatcher, Diagnostics diagnostics) {
        UiDispatcher publicationDispatcher = resilientDispatcher(dispatcher, diagnostics);
        snapshot = new PublishedState<>(PartyPublishedProjection.failedSnapshotResult(), publicationDispatcher);
        activeParty = new PublishedState<>(
                PartyPublishedProjection.failedActivePartyResult(), publicationDispatcher);
        activeComposition = new PublishedState<>(
                PartyPublishedProjection.failedActivePartyCompositionResult(), publicationDispatcher);
        activePartyFacts = new PublishedState<>(
                PartyPublishedProjection.failedActivePartyFactsResult(0L), publicationDispatcher);
        adventuringDaySummary = new PublishedState<>(
                PartyPublishedProjection.failedAdventuringDaySummaryResult(), publicationDispatcher);
        travelPositions = new PublishedState<>(
                PartyPublishedProjection.failedPartyTravelPositionsResult(0L), publicationDispatcher);
        mutation = new PublishedState<>(
                new MutationResult(MutationStatus.SUCCESS), publicationDispatcher);
        adventuringDayCalculation = new PublishedState<>(
                PartyPublishedProjection.failedAdventuringDayCalculationResult(), publicationDispatcher);
        snapshotModel = new PartySnapshotModel(snapshot::current, snapshot::subscribe);
        activePartyModel = new ActivePartyModel(activeParty::current, activeParty::subscribe);
        activeCompositionModel = new ActivePartyCompositionModel(
                activeComposition::current, activeComposition::subscribe);
        activePartyFactsModel = new ActivePartyFactsModel(
                activePartyFacts::current, activePartyFacts::subscribe);
        adventuringDaySummaryModel = new AdventuringDaySummaryModel(
                adventuringDaySummary::current, adventuringDaySummary::subscribe);
        travelPositionsModel = new PartyTravelPositionsModel(
                travelPositions::current, travelPositions::subscribe);
        mutationModel = new PartyMutationModel(mutation::current, mutation::subscribe);
        adventuringDayCalculationModel = new AdventuringDayCalculationModel(
                adventuringDayCalculation::current, adventuringDayCalculation::subscribe);
    }

    private static UiDispatcher resilientDispatcher(UiDispatcher dispatcher, Diagnostics diagnostics) {
        UiDispatcher delegate = java.util.Objects.requireNonNull(dispatcher, "dispatcher");
        Diagnostics failureSink = java.util.Objects.requireNonNull(diagnostics, "diagnostics");
        return update -> {
            try {
                delegate.dispatch(() -> {
                    try {
                        update.run();
                    } catch (RuntimeException callbackFailure) {
                        reportPublicationFailure(failureSink, callbackFailure);
                    }
                });
            } catch (RuntimeException schedulingFailure) {
                reportPublicationFailure(failureSink, schedulingFailure);
            }
        };
    }

    private static void reportPublicationFailure(Diagnostics diagnostics, RuntimeException failure) {
        try {
            diagnostics.failure(PUBLICATION_CALLBACK_FAILURE, failure.getClass());
        } catch (RuntimeException ignoredDiagnosticFailure) {
            // A diagnostic sink cannot regain mutation authority or interrupt publication.
        }
    }

    public PartySnapshotModel snapshotModel() {
        return snapshotModel;
    }

    public ActivePartyModel activePartyModel() {
        return activePartyModel;
    }

    public ActivePartyCompositionModel activeCompositionModel() {
        return activeCompositionModel;
    }

    public ActivePartyFactsModel activePartyFactsModel() {
        return activePartyFactsModel;
    }

    public AdventuringDaySummaryModel adventuringDaySummaryModel() {
        return adventuringDaySummaryModel;
    }

    public PartyTravelPositionsModel travelPositionsModel() {
        return travelPositionsModel;
    }

    public PartyMutationModel mutationModel() {
        return mutationModel;
    }

    public AdventuringDayCalculationModel adventuringDayCalculationModel() {
        return adventuringDayCalculationModel;
    }

    void publishRoster(PartyRoster roster) {
        long factsRevision = activePartyFactsRevision.incrementAndGet();
        long travelRevision = travelPositionRevision.incrementAndGet();
        ActivePartyFactsResult nextFacts = PartyPublishedProjection.activePartyFactsResult(roster, factsRevision);
        PartySnapshotResult nextSnapshot = PartyPublishedProjection.snapshotResult(roster);
        ActivePartyResult nextActiveParty = PartyPublishedProjection.activePartyResult(roster);
        ActivePartyCompositionResult nextComposition =
                PartyPublishedProjection.activePartyCompositionResult(roster);
        AdventuringDayResult nextDay = PartyPublishedProjection.adventuringDaySummaryResult(roster);
        PartyTravelPositionsResult nextTravel =
                PartyPublishedProjection.partyTravelPositionsResult(roster, travelRevision);

        activePartyFacts.publish(nextFacts);
        snapshot.publish(nextSnapshot);
        activeParty.publish(nextActiveParty);
        activeComposition.publish(nextComposition);
        adventuringDaySummary.publish(nextDay);
        travelPositions.publish(nextTravel);
    }

    void publishRosterStorageFailure() {
        activePartyFacts.publish(PartyPublishedProjection.failedActivePartyFactsResult(
                activePartyFactsRevision.incrementAndGet()));
        snapshot.publish(PartyPublishedProjection.failedSnapshotResult());
        activeParty.publish(PartyPublishedProjection.failedActivePartyResult());
        activeComposition.publish(PartyPublishedProjection.failedActivePartyCompositionResult());
        adventuringDaySummary.publish(PartyPublishedProjection.failedAdventuringDaySummaryResult());
        travelPositions.publish(PartyPublishedProjection.failedPartyTravelPositionsResult(
                travelPositionRevision.incrementAndGet()));
    }

    void publishMutation(MutationResult result) {
        mutation.publish(result);
    }

    void publishAdventuringDayCalculation(AdventuringDayCalculationResult result) {
        adventuringDayCalculation.publish(result);
    }
}
