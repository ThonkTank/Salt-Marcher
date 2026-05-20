package src.domain.party;

import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;

final class PartyServiceAssembly {

    private final AtomicReference<PartyPublishedStateRepositoryAdapter> publishedState =
            new AtomicReference<>();

    PartyApplicationService createApplicationService(ServiceRegistry services) {
        PartyRosterRepository repository = services.require(PartyRosterRepository.class);
        PartyPublishedStateRepositoryAdapter state = publishedState(services);
        PartyPublishedStateRepository publishedStateRepository = state;
        return new PartyApplicationService(
                new CreateCharacterUseCase(repository, publishedStateRepository),
                new UpdateCharacterUseCase(repository, publishedStateRepository),
                new DeleteCharacterUseCase(repository, publishedStateRepository),
                new SetPartyMembershipUseCase(repository, publishedStateRepository),
                new AdjustPartyXpUseCase(repository, publishedStateRepository),
                new AwardPartyXpUseCase(repository, publishedStateRepository),
                new PerformPartyRestUseCase(repository, publishedStateRepository),
                new MovePartyCharactersUseCase(repository, publishedStateRepository),
                new CalculateAdventuringDayUseCase(publishedStateRepository));
    }

    PartySnapshotModel partySnapshotModel(ServiceRegistry services) {
        return publishedState(services).partySnapshotModel;
    }

    ActivePartyModel activePartyModel(ServiceRegistry services) {
        return publishedState(services).activePartyModel;
    }

    ActivePartyCompositionModel activePartyCompositionModel(ServiceRegistry services) {
        return publishedState(services).activePartyCompositionModel;
    }

    AdventuringDaySummaryModel adventuringDaySummaryModel(ServiceRegistry services) {
        return publishedState(services).adventuringDaySummaryModel;
    }

    PartyTravelPositionsModel partyTravelPositionsModel(ServiceRegistry services) {
        return publishedState(services).partyTravelPositionsModel;
    }

    PartyMutationModel partyMutationModel(ServiceRegistry services) {
        return publishedState(services).partyMutationModel;
    }

    AdventuringDayCalculationModel adventuringDayCalculationModel(ServiceRegistry services) {
        return publishedState(services).adventuringDayCalculationModel;
    }

    private PartyPublishedStateRepositoryAdapter publishedState(ServiceRegistry services) {
        PartyPublishedStateRepositoryAdapter existing = publishedState.get();
        if (existing != null) {
            return existing;
        }
        PartyPublishedStateRepositoryAdapter candidate =
                new PartyPublishedStateRepositoryAdapter(services.require(PartyRosterRepository.class));
        return publishedState.compareAndSet(null, candidate)
                ? candidate
                : java.util.Objects.requireNonNull(publishedState.get(), "publishedState");
    }
}
