package src.domain.party;

import java.util.Objects;
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

public final class PartyApplicationServiceFactory {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public PartyApplicationServiceFactory() {
        // Public factory bridge for data-layer runtime assembly.
    }

    public PartyApplicationService create(
            PartyRosterRepository rosterRepository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        PartyPublishedStateRepository publishedState =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        return new PartyApplicationService(
                new CreateCharacterUseCase(repository, publishedState),
                new UpdateCharacterUseCase(repository, publishedState),
                new DeleteCharacterUseCase(repository, publishedState),
                new SetPartyMembershipUseCase(repository, publishedState),
                new AdjustPartyXpUseCase(repository, publishedState),
                new AwardPartyXpUseCase(repository, publishedState),
                new PerformPartyRestUseCase(repository, publishedState),
                new MovePartyCharactersUseCase(repository, publishedState),
                new CalculateAdventuringDayUseCase(publishedState));
    }
}
