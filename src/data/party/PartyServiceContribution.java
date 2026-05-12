package src.data.party;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.data.party.repository.PartyPublishedStateRepositoryAdapter;
import src.domain.party.PartyApplicationService;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

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
        PartyPublishedStateRepositoryAdapter publishedState = new PartyPublishedStateRepositoryAdapter(repository);
        PartyPublishedStateRepository publishedStateRepository = publishedState;
        PartyApplicationService service = new PartyApplicationService(
                new CreateCharacterUseCase(repository, publishedStateRepository),
                new UpdateCharacterUseCase(repository, publishedStateRepository),
                new DeleteCharacterUseCase(repository, publishedStateRepository),
                new SetPartyMembershipUseCase(repository, publishedStateRepository),
                new AdjustPartyXpUseCase(repository, publishedStateRepository),
                new AwardPartyXpUseCase(repository, publishedStateRepository),
                new PerformPartyRestUseCase(repository, publishedStateRepository),
                new MovePartyCharactersUseCase(repository, publishedStateRepository),
                new CalculateAdventuringDayUseCase(publishedStateRepository));
        builder.register(PartyApplicationService.class, service);
        builder.register(PartySnapshotModel.class, publishedState.partySnapshotModel);
        builder.register(ActivePartyModel.class, publishedState.activePartyModel);
        builder.register(ActivePartyCompositionModel.class, publishedState.activePartyCompositionModel);
        builder.register(AdventuringDaySummaryModel.class, publishedState.adventuringDaySummaryModel);
        builder.register(PartyTravelPositionsModel.class, publishedState.partyTravelPositionsModel);
        builder.register(PartyMutationModel.class, publishedState.partyMutationModel);
        builder.register(AdventuringDayCalculationModel.class, publishedState.adventuringDayCalculationModel);
    }
}
