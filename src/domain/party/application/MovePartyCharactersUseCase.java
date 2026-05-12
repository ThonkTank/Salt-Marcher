package src.domain.party.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.helper.PartyRosterMutationHelper;
import src.domain.party.model.roster.model.PartyDungeonTravelLocationKind;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyTravelHeading;
import src.domain.party.model.roster.model.PartyTravelLocation;
import src.domain.party.model.roster.model.PartyTravelTile;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class MovePartyCharactersUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyRosterMutationHelper mutations = new PartyRosterMutationHelper();

    public MovePartyCharactersUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            List<Long> characterIds,
            String travelSpace,
            long mapId,
            long tileId,
            String dungeonLocationKind,
            long ownerId,
            int q,
            int r,
            int level,
            String heading,
            boolean attachToPartyToken
    ) {
        try {
            PartyMutationStatus status = move(
                    characterIds,
                    location(travelSpace, mapId, tileId, dungeonLocationKind, ownerId, q, r, level, heading),
                    attachToPartyToken);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus move(
            List<Long> characterIds,
            @Nullable PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        if (location == null) {
            return PartyMutationStatus.INVALID_INPUT;
        }
        PartyRoster roster = repository.load();
        java.util.List<src.domain.party.model.roster.model.PartyCharacter> nextCharacters =
                mutations.moveCharacters(roster.characters(), characterIds, location, attachToPartyToken);
        if (nextCharacters.isEmpty()) {
            return PartyMutationStatus.NOT_FOUND;
        }
        repository.save(roster.withCharacters(nextCharacters));
        return PartyMutationStatus.SUCCESS;
    }

    private void publish(PartyMutationStatus status) {
        if (status == PartyMutationStatus.SUCCESS) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }

    private static @Nullable PartyTravelLocation location(
            String travelSpace,
            long mapId,
            long tileId,
            String dungeonLocationKind,
            long ownerId,
            int q,
            int r,
            int level,
            String heading
    ) {
        if ("DUNGEON".equals(travelSpace)) {
            return PartyTravelLocation.dungeon(
                    mapId,
                    PartyDungeonTravelLocationKind.parse(dungeonLocationKind),
                    ownerId,
                    new PartyTravelTile(q, r, level),
                    PartyTravelHeading.parse(heading));
        }
        if ("OVERWORLD".equals(travelSpace)) {
            return PartyTravelLocation.overworld(mapId, tileId);
        }
        return null;
    }
}
