package features.party.application;

import static features.party.api.PartyDungeonTravelLocationKind.TRANSITION;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import features.party.domain.roster.PartyCharacterDraft;
import features.party.domain.roster.PartyDungeonTravelLocationKind;
import features.party.domain.roster.PartyMembership;
import features.party.domain.roster.PartyRestType;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.PartyRosterMutation;
import features.party.domain.roster.PartyTravelHeading;
import features.party.domain.roster.PartyTravelLocation;
import features.party.domain.roster.helper.AdventuringDayProgressCalculationHelper;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdjustPartyXpCommand;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.AwardPartyXpCommand;
import features.party.api.CalculateAdventuringDayCommand;
import features.party.api.CreateCharacterCommand;
import features.party.api.DeleteCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyMutationModel;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartySnapshotModel;
import features.party.api.PartyTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelTile;
import features.party.api.PerformPartyRestCommand;
import features.party.api.RestType;
import features.party.api.SetPartyMembershipCommand;
import features.party.api.UpdateCharacterCommand;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService implements features.party.api.PartyApi {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("party.storage-failure");

    private final PartyRosterRepository repository;
    private final PartyPublishedState publishedState;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private final AdventuringDayProgressCalculationHelper adventuringDayProgress =
            new AdventuringDayProgressCalculationHelper();

    public PartyApplicationService(
            PartyRosterRepository repository,
            PartyPublishedState publishedState,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public void refreshPublishedState() {
        executionLane.execute(this::publishRepositoryBackedStateFromRepository);
    }

    public void createCharacter(CreateCharacterCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.createCharacter(
                new PartyCharacterDraft(
                        command == null ? null : command.createDraftName(),
                        command == null ? null : command.createDraftPlayerName(),
                        command == null ? 0 : command.createDraftLevel(),
                        command == null ? 0 : command.createDraftPassivePerception(),
                        command == null ? 0 : command.createDraftArmorClass()),
                command == null ? PartyMembership.RESERVE : membership(command.membership()))));
    }

    public void updateCharacter(UpdateCharacterCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.updateCharacter(
                command == null ? 0L : command.id(),
                new PartyCharacterDraft(
                        command == null ? null : command.updateDraftName(),
                        command == null ? null : command.updateDraftPlayerName(),
                        command == null ? 0 : command.updateDraftLevel(),
                        command == null ? 0 : command.updateDraftPassivePerception(),
                        command == null ? 0 : command.updateDraftArmorClass()))));
    }

    public void deleteCharacter(DeleteCharacterCommand command) {
        executionLane.execute(() -> runRosterMutation(
                roster -> roster.deleteCharacter(command == null ? 0L : command.id())));
    }

    public void setMembership(SetPartyMembershipCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.setMembership(
                command == null ? 0L : command.id(),
                command == null ? PartyMembership.RESERVE : membership(command.membership()))));
    }

    public void awardXp(AwardPartyXpCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.adjustXp(
                command == null ? List.of() : command.ids(),
                command == null ? 0 : Math.max(0, command.xpPerCharacter()))));
    }

    public void adjustXp(AdjustPartyXpCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.adjustXp(
                command == null ? List.of() : command.ids(),
                command == null ? 0 : command.xpDelta())));
    }

    public void performRest(PerformPartyRestCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.performRest(
                command == null ? PartyRestType.SHORT_REST : restType(command.restType()))));
    }

    public void moveCharacters(MovePartyCharactersCommand command) {
        executionLane.execute(() -> runRosterMutation(roster -> roster.moveCharacters(
                command == null ? List.of() : command.characterIds(),
                travelLocation(command == null ? null : command.target()),
                command == null || command.attachToPartyToken())));
    }

    public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
        executionLane.execute(() -> calculateAdventuringDayOnLane(command));
    }

    private void calculateAdventuringDayOnLane(CalculateAdventuringDayCommand command) {
        try {
            publishedState.publishAdventuringDayCalculation(PartyPublishedProjection.adventuringDayCalculationResult(
                    command == null ? List.of() : command.levels(),
                    command == null ? 0 : command.totalGroupXp(),
                    adventuringDayProgress));
        } catch (IllegalStateException exception) {
            publishedState.publishAdventuringDayCalculation(PartyPublishedProjection.adventuringDayCalculationResult(
                    List.of(),
                    0,
                    adventuringDayProgress));
        }
    }

    private void runRosterMutation(RosterMutationAction action) {
        try {
            PartyRosterMutation mutation = action.apply(repository.load());
            if (mutation.successful()) {
                repository.save(mutation.roster());
                publishRepositoryBackedState(mutation.roster());
            }
            publishedState.publishMutation(PartyPublishedProjection.mutationResult(mutation.status()));
        } catch (IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            publishedState.publishMutation(PartyPublishedProjection.storageErrorMutationResult());
        }
    }

    private void publishRepositoryBackedState(PartyRoster roster) {
        publishedState.publishRoster(roster);
    }

    private void publishRepositoryBackedStateFromRepository() {
        try {
            publishRepositoryBackedState(repository.load());
        } catch (IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            publishedState.publishRosterStorageFailure();
        }
    }

    private static PartyMembership membership(MembershipState membership) {
        return membership == MembershipState.ACTIVE ? PartyMembership.ACTIVE : PartyMembership.RESERVE;
    }

    private static PartyRestType restType(RestType restType) {
        return restType == RestType.LONG_REST ? PartyRestType.LONG_REST : PartyRestType.SHORT_REST;
    }

    private static @Nullable PartyTravelLocation travelLocation(@Nullable PartyTravelLocationSnapshot target) {
        if (target instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            PartyTravelTile tile = dungeon.tile();
            return PartyTravelLocation.dungeon(
                    dungeon.mapId(),
                    dungeonLocationKind(dungeon.locationKind()),
                    dungeon.ownerId(),
                    new features.party.domain.roster.PartyTravelTile(tile.q(), tile.r(), tile.level()),
                    travelHeading(dungeon.heading()));
        }
        if (target instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return PartyTravelLocation.overworld(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private static PartyDungeonTravelLocationKind dungeonLocationKind(
            features.party.api.PartyDungeonTravelLocationKind locationKind
    ) {
        return locationKind == TRANSITION ? PartyDungeonTravelLocationKind.TRANSITION : PartyDungeonTravelLocationKind.TILE;
    }

    private static PartyTravelHeading travelHeading(features.party.api.PartyTravelHeading heading) {
        if (heading == null) {
            return PartyTravelHeading.SOUTH;
        }
        return switch (heading) {
            case NORTH -> PartyTravelHeading.NORTH;
            case EAST -> PartyTravelHeading.EAST;
            case WEST -> PartyTravelHeading.WEST;
            case SOUTH -> PartyTravelHeading.SOUTH;
        };
    }

    @Override
    public PartySnapshotModel snapshot() {
        return publishedState.snapshotModel();
    }

    @Override
    public ActivePartyModel activeParty() {
        return publishedState.activePartyModel();
    }

    @Override
    public ActivePartyCompositionModel activeComposition() {
        return publishedState.activeCompositionModel();
    }

    @Override
    public AdventuringDaySummaryModel adventuringDaySummary() {
        return publishedState.adventuringDaySummaryModel();
    }

    @Override
    public PartyTravelPositionsModel travelPositions() {
        return publishedState.travelPositionsModel();
    }

    @Override
    public PartyMutationModel mutation() {
        return publishedState.mutationModel();
    }

    @Override
    public AdventuringDayCalculationModel adventuringDayCalculation() {
        return publishedState.adventuringDayCalculationModel();
    }

    @FunctionalInterface
    private interface RosterMutationAction {

        PartyRosterMutation apply(PartyRoster roster);
    }
}
