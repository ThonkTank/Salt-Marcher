package src.domain.party.model.roster.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyMutationStatus;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterMutation;
import src.domain.party.model.roster.PartyTravelLocation;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class MovePartyCharactersUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;

    public MovePartyCharactersUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(TravelCommand command) {
        TravelCommand safeCommand = command == null ? TravelCommand.empty() : command;
        try {
            PartyMutationStatus status = move(
                    safeCommand.characterIds(),
                    safeCommand.toLocation(),
                    safeCommand.attachToPartyToken());
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation(
                    new PartyPublishedStateRepository.StatePublication());
        }
    }

    private PartyMutationStatus move(
            List<Long> characterIds,
            @Nullable PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.moveCharacters(characterIds, location, attachToPartyToken);
        if (mutation.successful()) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState(
                    new PartyPublishedStateRepository.StatePublication());
        }
        publishedStateRepository.publishMutationStatus(status);
    }

    public record TravelCommand(
            List<Long> characterIds,
            @Nullable TravelTarget target,
            boolean attachToPartyToken
    ) {

        public TravelCommand {
            characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
        }

        static TravelCommand empty() {
            return new TravelCommand(List.of(), null, true);
        }

        private @Nullable PartyTravelLocation toLocation() {
            return target == null ? null : target.toLocation();
        }
    }

    public record TravelTarget(
            boolean dungeon,
            long mapId,
            String dungeonLocationKindName,
            long dungeonOwnerId,
            int dungeonTileQ,
            int dungeonTileR,
            int dungeonTileLevel,
            String dungeonHeadingName,
            long overworldTileId
    ) {

        private PartyTravelLocation toLocation() {
            if (dungeon) {
                return PartyTravelLocation.dungeon(
                        mapId,
                        dungeonLocationKindName,
                        dungeonOwnerId,
                        dungeonTileQ,
                        dungeonTileR,
                        dungeonTileLevel,
                        dungeonHeadingName);
            }
            return PartyTravelLocation.overworld(mapId, overworldTileId);
        }
    }
}
