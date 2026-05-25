package src.domain.party;

import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.MutationResult;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;

abstract class PartyPublishedModelsServiceAssembly {

    final PartyRosterPublishedModelsServiceAssembly rosterModels = new PartyRosterPublishedModelsServiceAssembly();
    private final PartyPublishedModelChannelServiceAssembly<AdventuringDayResult> adventuringDaySummary =
            new PartyPublishedModelChannelServiceAssembly<>(
                    PartyAdventuringDayProjectionServiceAssembly.failedAdventuringDaySummaryResult());
    private final PartyPublishedModelChannelServiceAssembly<PartyTravelPositionsResult> partyTravelPositions =
            new PartyPublishedModelChannelServiceAssembly<>(
                    PartyTravelProjectionServiceAssembly.failedPartyTravelPositionsResult());
    private final PartyPublishedModelChannelServiceAssembly<MutationResult> partyMutation =
            new PartyPublishedModelChannelServiceAssembly<>(PartyMutationProjectionServiceAssembly.defaultMutationResult());
    private final PartyPublishedModelChannelServiceAssembly<AdventuringDayCalculationResult>
            adventuringDayCalculation = new PartyPublishedModelChannelServiceAssembly<>(
                    PartyAdventuringDayProjectionServiceAssembly.failedAdventuringDayCalculationResult());
    private final AdventuringDaySummaryModel adventuringDaySummaryModel = new AdventuringDaySummaryModel(
            adventuringDaySummary::current,
            adventuringDaySummary::subscribe);
    private final PartyTravelPositionsModel partyTravelPositionsModel = new PartyTravelPositionsModel(
            partyTravelPositions::current,
            partyTravelPositions::subscribe);
    private final PartyMutationModel partyMutationModel = new PartyMutationModel(
            partyMutation::current,
            partyMutation::subscribe);
    private final AdventuringDayCalculationModel adventuringDayCalculationModel =
            new AdventuringDayCalculationModel(adventuringDayCalculation::current, adventuringDayCalculation::subscribe);

    AdventuringDaySummaryModel adventuringDaySummaryModel() {
        return java.util.Objects.requireNonNull(adventuringDaySummaryModel, "adventuringDaySummaryModel");
    }

    PartyTravelPositionsModel partyTravelPositionsModel() {
        return java.util.Objects.requireNonNull(partyTravelPositionsModel, "partyTravelPositionsModel");
    }

    PartyMutationModel partyMutationModel() {
        return java.util.Objects.requireNonNull(partyMutationModel, "partyMutationModel");
    }

    AdventuringDayCalculationModel adventuringDayCalculationModel() {
        return java.util.Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
    }

    final void refreshRepositoryBackedState(PartyPublishedReadbackServiceAssembly readback, boolean notify) {
        if (notify) {
            rosterModels.publishRepositoryBackedState(readback);
            adventuringDaySummary.publish(readback.readAdventuringDaySummaryResult());
            partyTravelPositions.publish(readback.readPartyTravelPositionsResult());
            return;
        }
        rosterModels.replaceRepositoryBackedState(readback);
        adventuringDaySummary.replace(readback.readAdventuringDaySummaryResult());
        partyTravelPositions.replace(readback.readPartyTravelPositionsResult());
    }

    final void publishMutationResult(MutationResult result) {
        partyMutation.publish(result);
    }

    final void publishStorageErrorMutationResult() {
        publishMutationResult(PartyMutationProjectionServiceAssembly.storageErrorMutationResult());
    }

    final void publishAdventuringDayCalculationResult(AdventuringDayCalculationResult result) {
        adventuringDayCalculation.publish(result);
    }
}
