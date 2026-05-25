package src.domain.party;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.model.roster.usecase.AdjustPartyXpUseCase;
import src.domain.party.model.roster.usecase.AwardPartyXpUseCase;
import src.domain.party.model.roster.usecase.CalculateAdventuringDayUseCase;
import src.domain.party.model.roster.usecase.CreateCharacterUseCase;
import src.domain.party.model.roster.usecase.DeleteCharacterUseCase;
import src.domain.party.model.roster.usecase.MovePartyCharactersUseCase;
import src.domain.party.model.roster.usecase.PerformPartyRestUseCase;
import src.domain.party.model.roster.usecase.SetPartyMembershipUseCase;
import src.domain.party.model.roster.usecase.UpdateCharacterUseCase;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;

final class PartyServiceAssembly {

    private final AtomicReference<PartyPublishedStateServiceAssembly> publishedState = new AtomicReference<>();

    PartyApplicationService createApplicationService(ServiceRegistry services) {
        PartyRosterRepository repository = services.require(PartyRosterRepository.class);
        PartyPublishedStateServiceAssembly state = publishedState(services);
        PartyPublishedStateRepository publishedStateRepository = state;
        PartyEncounterSessionRepository encounterSessionRepository =
                PartyEncounterSessionPublicationRefresh.INSTANCE;
        return new PartyApplicationService(
                new CreateCharacterUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new UpdateCharacterUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new DeleteCharacterUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new SetPartyMembershipUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new AdjustPartyXpUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new AwardPartyXpUseCase(repository, publishedStateRepository),
                new PerformPartyRestUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new MovePartyCharactersUseCase(repository, publishedStateRepository),
                new CalculateAdventuringDayUseCase(publishedStateRepository));
    }

    PartySnapshotModel partySnapshotModel(ServiceRegistry services) {
        return publishedState(services).partySnapshotModel();
    }

    ActivePartyModel activePartyModel(ServiceRegistry services) {
        return publishedState(services).activePartyModel();
    }

    ActivePartyCompositionModel activePartyCompositionModel(ServiceRegistry services) {
        return publishedState(services).activePartyCompositionModel();
    }

    AdventuringDaySummaryModel adventuringDaySummaryModel(ServiceRegistry services) {
        return publishedState(services).adventuringDaySummaryModel();
    }

    PartyTravelPositionsModel partyTravelPositionsModel(ServiceRegistry services) {
        return publishedState(services).partyTravelPositionsModel();
    }

    PartyMutationModel partyMutationModel(ServiceRegistry services) {
        return publishedState(services).partyMutationModel();
    }

    AdventuringDayCalculationModel adventuringDayCalculationModel(ServiceRegistry services) {
        return publishedState(services).adventuringDayCalculationModel();
    }

    private PartyPublishedStateServiceAssembly publishedState(ServiceRegistry services) {
        PartyPublishedStateServiceAssembly existing = publishedState.get();
        if (existing != null) {
            return existing;
        }
        PartyPublishedStateServiceAssembly candidate =
                new PartyPublishedStateServiceAssembly(services.require(PartyRosterRepository.class));
        return publishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(publishedState.get(), "publishedState");
    }

    private enum PartyEncounterSessionPublicationRefresh implements PartyEncounterSessionRepository {

        INSTANCE;

        @Override
        public void refreshEncounterSession() {
            // Party mutation publication is authoritative; consumers refresh from party published models.
        }
    }

}
