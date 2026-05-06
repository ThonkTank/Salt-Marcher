package src.data.party;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.party.application.PartyBoundaryRuntimeAdapter;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.roster.port.PartyRosterRepository;

/**
 * Root service entrypoint for the party feature.
 */
public final class PartyServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public PartyServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        PartyRosterRepository repository = new SqlitePartyRosterRepository();
        PartyBoundaryRuntimeAdapter runtime = new PartyBoundaryRuntimeAdapter(repository);
        PartyApplicationService service = new PartyApplicationService(runtime);
        builder.register(PartyApplicationService.class, service);
        builder.register(PartySnapshotModel.class, runtime.partySnapshotModel());
        builder.register(ActivePartyModel.class, runtime.activePartyModel());
        builder.register(ActivePartyCompositionModel.class, runtime.activePartyCompositionModel());
        builder.register(AdventuringDaySummaryModel.class, runtime.adventuringDaySummaryModel());
        builder.register(PartyTravelPositionsModel.class, runtime.partyTravelPositionsModel());
        builder.register(PartyMutationModel.class, runtime.partyMutationModel());
        builder.register(AdventuringDayCalculationModel.class, runtime.adventuringDayCalculationModel());
    }
}
