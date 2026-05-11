package src.domain.party;

import java.util.List;
import java.util.Objects;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.domain.party.model.roster.model.PartyCharacterDraft;
import src.domain.party.model.roster.model.PartyDungeonTravelLocation;
import src.domain.party.model.roster.model.PartyDungeonTravelLocationKind;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyOverworldTravelLocation;
import src.domain.party.model.roster.model.PartyRestType;
import src.domain.party.model.roster.model.PartyTravelHeading;
import src.domain.party.model.roster.model.PartyTravelLocation;
import src.domain.party.model.roster.model.PartyTravelTile;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private final PartyPublishedStateRepository publishedStateRepository;
    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AdjustPartyXpUseCase adjustPartyXpUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;
    private final MovePartyCharactersUseCase movePartyCharactersUseCase;

    public PartyApplicationService(
            PartyRosterRepository rosterRepository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.createCharacterUseCase = new CreateCharacterUseCase(repository);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(repository);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(repository);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(repository);
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(repository);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(repository);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(repository);
        this.movePartyCharactersUseCase = new MovePartyCharactersUseCase(repository);
    }

    public void createCharacter(CreateCharacterCommand command) {
        runMutation(() -> createCharacterUseCase.execute(
                BoundaryValues.draft(command == null ? null : command.draft()),
                BoundaryValues.membership(command == null ? null : command.membership())));
    }

    public void updateCharacter(UpdateCharacterCommand command) {
        runMutation(() -> updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                BoundaryValues.draft(command == null ? null : command.draft())));
    }

    public void deleteCharacter(DeleteCharacterCommand command) {
        runMutation(() -> deleteCharacterUseCase.execute(command == null ? 0L : command.id()));
    }

    public void setMembership(SetPartyMembershipCommand command) {
        runMutation(() -> setPartyMembershipUseCase.execute(
                command == null ? 0L : command.id(),
                BoundaryValues.membership(command == null ? null : command.membership())));
    }

    public void awardXp(AwardPartyXpCommand command) {
        runMutation(() -> awardPartyXpUseCase.execute(
                BoundaryValues.ids(command == null ? null : command.ids()),
                command == null ? 0 : command.xpPerCharacter()));
    }

    public void adjustXp(AdjustPartyXpCommand command) {
        runMutation(() -> adjustPartyXpUseCase.execute(
                BoundaryValues.ids(command == null ? null : command.ids()),
                command == null ? 0 : command.xpDelta()));
    }

    public void performRest(PerformPartyRestCommand command) {
        runMutation(() -> performPartyRestUseCase.execute(
                BoundaryValues.restType(command == null ? null : command.restType())));
    }

    public void moveCharacters(MovePartyCharactersCommand command) {
        runMutation(() -> movePartyCharactersUseCase.execute(
                BoundaryValues.ids(command == null ? null : command.characterIds()),
                BoundaryValues.travelLocation(command == null ? null : command.target()),
                command == null || command.attachToPartyToken()));
    }

    public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
        publishedStateRepository.publishAdventuringDayCalculation(
                BoundaryValues.levels(command == null ? null : command.levels()),
                command == null ? 0 : command.totalGroupXp());
    }

    private void runMutation(PartyMutationOperation operation) {
        try {
            PartyMutationStatus status = operation.execute();
            if (status == PartyMutationStatus.SUCCESS) {
                publishedStateRepository.publishRepositoryBackedState();
            }
            publishedStateRepository.publishMutationStatus(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private interface PartyMutationOperation {
        PartyMutationStatus execute();
    }

    private static final class BoundaryValues {

        private static PartyMembership membership(
                src.domain.party.published.MembershipState membershipState
        ) {
            src.domain.party.published.MembershipState effective = membershipState == null
                    ? src.domain.party.published.MembershipState.valueOf("RESERVE")
                    : membershipState;
            return PartyMembership.valueOf(effective.name());
        }

        private static PartyCharacterDraft draft(
                src.domain.party.published.CharacterDraft draft
        ) {
            if (draft == null) {
                return new PartyCharacterDraft("", "", 0, 0, 0);
            }
            return new PartyCharacterDraft(
                    draft.name(),
                    draft.playerName(),
                    draft.level(),
                    draft.passivePerception(),
                    draft.armorClass());
        }

        private static List<Long> ids(List<Long> ids) {
            return ids == null ? List.of() : List.copyOf(ids);
        }

        private static List<Integer> levels(List<Integer> levels) {
            return levels == null ? List.of() : List.copyOf(levels);
        }

        private static PartyRestType restType(
                src.domain.party.published.RestType restType
        ) {
            src.domain.party.published.RestType effective = restType == null
                    ? src.domain.party.published.RestType.valueOf("SHORT_REST")
                    : restType;
            return PartyRestType.valueOf(effective.name());
        }

        private static PartyTravelLocation travelLocation(
                src.domain.party.published.PartyTravelLocationSnapshot location
        ) {
            if (location instanceof src.domain.party.published.PartyDungeonTravelLocationSnapshot dungeon) {
                return new PartyDungeonTravelLocation(
                        dungeon.mapId(),
                        toInternalDungeonLocationKind(dungeon.locationKind()),
                        dungeon.ownerId(),
                        toInternalTile(dungeon.tile()),
                        toInternalHeading(dungeon.heading()));
            }
            if (location instanceof src.domain.party.published.PartyOverworldTravelLocationSnapshot overworld) {
                return new PartyOverworldTravelLocation(
                        overworld.mapId(),
                        overworld.tileId());
            }
            return null;
        }

        private static PartyDungeonTravelLocationKind toInternalDungeonLocationKind(
                src.domain.party.published.PartyDungeonTravelLocationKind locationKind
        ) {
            src.domain.party.published.PartyDungeonTravelLocationKind effective = locationKind == null
                    ? src.domain.party.published.PartyDungeonTravelLocationKind.valueOf("TILE")
                    : locationKind;
            return PartyDungeonTravelLocationKind.valueOf(effective.name());
        }

        private static PartyTravelTile toInternalTile(
                src.domain.party.published.PartyTravelTile tile
        ) {
            src.domain.party.published.PartyTravelTile safeTile = tile == null
                    ? new src.domain.party.published.PartyTravelTile(0, 0, 0)
                    : tile;
            return new PartyTravelTile(
                    safeTile.q(),
                    safeTile.r(),
                    safeTile.level());
        }

        private static PartyTravelHeading toInternalHeading(
                src.domain.party.published.PartyTravelHeading heading
        ) {
            src.domain.party.published.PartyTravelHeading effective = heading == null
                    ? src.domain.party.published.PartyTravelHeading.defaultHeading()
                    : heading;
            return PartyTravelHeading.valueOf(effective.name());
        }
    }
}
