package features.party.application;

import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyCompositionResult;
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
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class PartyPublishedState {

    private final PublishedState<PartySnapshotResult> snapshot;
    private final PublishedState<ActivePartyResult> activeParty;
    private final PublishedState<ActivePartyCompositionResult> activeComposition;
    private final PublishedState<AdventuringDayResult> adventuringDaySummary;
    private final PublishedState<PartyTravelPositionsResult> travelPositions;
    private final PublishedState<MutationResult> mutation;
    private final PublishedState<AdventuringDayCalculationResult> adventuringDayCalculation;
    private final AtomicLong travelPositionRevision = new AtomicLong();
    private final PartySnapshotModel snapshotModel;
    private final ActivePartyModel activePartyModel;
    private final ActivePartyCompositionModel activeCompositionModel;
    private final AdventuringDaySummaryModel adventuringDaySummaryModel;
    private final PartyTravelPositionsModel travelPositionsModel;
    private final PartyMutationModel mutationModel;
    private final AdventuringDayCalculationModel adventuringDayCalculationModel;

    public PartyPublishedState(UiDispatcher dispatcher) {
        snapshot = new PublishedState<>(PartyPublishedProjection.failedSnapshotResult(), dispatcher);
        activeParty = new PublishedState<>(PartyPublishedProjection.failedActivePartyResult(), dispatcher);
        activeComposition = new PublishedState<>(
                PartyPublishedProjection.failedActivePartyCompositionResult(), dispatcher);
        adventuringDaySummary = new PublishedState<>(
                PartyPublishedProjection.failedAdventuringDaySummaryResult(), dispatcher);
        travelPositions = new PublishedState<>(
                PartyPublishedProjection.failedPartyTravelPositionsResult(0L), dispatcher);
        mutation = new PublishedState<>(new MutationResult(MutationStatus.SUCCESS), dispatcher);
        adventuringDayCalculation = new PublishedState<>(
                PartyPublishedProjection.failedAdventuringDayCalculationResult(), dispatcher);
        snapshotModel = new PartySnapshotModel(snapshot::current, snapshot::subscribe);
        activePartyModel = new ActivePartyModel(activeParty::current, activeParty::subscribe);
        activeCompositionModel = new ActivePartyCompositionModel(
                activeComposition::current, activeComposition::subscribe);
        adventuringDaySummaryModel = new AdventuringDaySummaryModel(
                adventuringDaySummary::current, adventuringDaySummary::subscribe);
        travelPositionsModel = new PartyTravelPositionsModel(
                travelPositions::current, travelPositions::subscribe);
        mutationModel = new PartyMutationModel(mutation::current, mutation::subscribe);
        adventuringDayCalculationModel = new AdventuringDayCalculationModel(
                adventuringDayCalculation::current, adventuringDayCalculation::subscribe);
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
        snapshot.publish(PartyPublishedProjection.snapshotResult(roster));
        activeParty.publish(PartyPublishedProjection.activePartyResult(roster));
        activeComposition.publish(PartyPublishedProjection.activePartyCompositionResult(roster));
        adventuringDaySummary.publish(PartyPublishedProjection.adventuringDaySummaryResult(roster));
        travelPositions.publish(PartyPublishedProjection.partyTravelPositionsResult(
                roster, travelPositionRevision.incrementAndGet()));
    }

    void publishRosterStorageFailure() {
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
