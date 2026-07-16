package src.domain.party;

import java.util.Objects;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class PartyServiceAssembly {

    private PartyServiceAssembly() {
    }

    public static Component create(PartyRosterRepository repository) {
        PartySnapshotModel snapshot = new PartySnapshotModel();
        ActivePartyModel activeParty = new ActivePartyModel();
        ActivePartyCompositionModel activeComposition = new ActivePartyCompositionModel();
        AdventuringDaySummaryModel daySummary = new AdventuringDaySummaryModel();
        PartyTravelPositionsModel travelPositions = new PartyTravelPositionsModel();
        PartyMutationModel mutation = new PartyMutationModel();
        AdventuringDayCalculationModel dayCalculation = new AdventuringDayCalculationModel();
        PartyApplicationService application = new PartyApplicationService(
                Objects.requireNonNull(repository, "repository"),
                snapshot,
                activeParty,
                activeComposition,
                daySummary,
                travelPositions,
                mutation,
                dayCalculation);
        application.refreshPublishedState();
        return new Component(application, snapshot, activeParty, activeComposition, daySummary,
                travelPositions, mutation, dayCalculation);
    }

    public record Component(
            PartyApplicationService application,
            PartySnapshotModel snapshot,
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activeComposition,
            AdventuringDaySummaryModel adventuringDaySummary,
            PartyTravelPositionsModel travelPositions,
            PartyMutationModel mutation,
            AdventuringDayCalculationModel adventuringDayCalculation
    ) {
    }
}
