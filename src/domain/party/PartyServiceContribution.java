package src.domain.party;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class PartyServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public PartyServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        PartyServiceAssembly assembly = new PartyServiceAssembly();
        services.registerFactory(PartyApplicationService.class, assembly::createApplicationService);
        services.registerFactory(PartySnapshotModel.class, assembly::partySnapshotModel);
        services.registerFactory(ActivePartyModel.class, assembly::activePartyModel);
        services.registerFactory(ActivePartyCompositionModel.class, assembly::activePartyCompositionModel);
        services.registerFactory(AdventuringDaySummaryModel.class, assembly::adventuringDaySummaryModel);
        services.registerFactory(PartyTravelPositionsModel.class, assembly::partyTravelPositionsModel);
        services.registerFactory(PartyMutationModel.class, assembly::partyMutationModel);
        services.registerFactory(AdventuringDayCalculationModel.class, assembly::adventuringDayCalculationModel);
    }
}
