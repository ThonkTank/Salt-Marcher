package src.domain.party;

import static src.domain.party.published.PartyDungeonTravelLocationKind.TRANSITION;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import src.domain.party.model.roster.PartyCharacterDraft;
import src.domain.party.model.roster.PartyDungeonTravelLocationKind;
import src.domain.party.model.roster.PartyMembership;
import src.domain.party.model.roster.PartyRestType;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterMutation;
import src.domain.party.model.roster.PartyTravelHeading;
import src.domain.party.model.roster.PartyTravelLocation;
import src.domain.party.model.roster.helper.AdventuringDayProgressCalculationHelper;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("party.storage-failure");

    private final PartyRosterRepository repository;
    private final PartySnapshotModel partySnapshotModel;
    private final ActivePartyModel activePartyModel;
    private final ActivePartyCompositionModel activePartyCompositionModel;
    private final AdventuringDaySummaryModel adventuringDaySummaryModel;
    private final PartyTravelPositionsModel partyTravelPositionsModel;
    private final PartyMutationModel partyMutationModel;
    private final AdventuringDayCalculationModel adventuringDayCalculationModel;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private final AdventuringDayProgressCalculationHelper adventuringDayProgress =
            new AdventuringDayProgressCalculationHelper();

    PartyApplicationService(
            PartyRosterRepository repository,
            PartySnapshotModel partySnapshotModel,
            ActivePartyModel activePartyModel,
            ActivePartyCompositionModel activePartyCompositionModel,
            AdventuringDaySummaryModel adventuringDaySummaryModel,
            PartyTravelPositionsModel partyTravelPositionsModel,
            PartyMutationModel partyMutationModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partySnapshotModel = Objects.requireNonNull(partySnapshotModel, "partySnapshotModel");
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        this.activePartyCompositionModel =
                Objects.requireNonNull(activePartyCompositionModel, "activePartyCompositionModel");
        this.adventuringDaySummaryModel =
                Objects.requireNonNull(adventuringDaySummaryModel, "adventuringDaySummaryModel");
        this.partyTravelPositionsModel = Objects.requireNonNull(partyTravelPositionsModel, "partyTravelPositionsModel");
        this.partyMutationModel = Objects.requireNonNull(partyMutationModel, "partyMutationModel");
        this.adventuringDayCalculationModel =
                Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    void refreshPublishedState() {
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
            adventuringDayCalculationModel.publish(PartyPublishedProjection.adventuringDayCalculationResult(
                    command == null ? List.of() : command.levels(),
                    command == null ? 0 : command.totalGroupXp(),
                    adventuringDayProgress));
        } catch (IllegalStateException exception) {
            adventuringDayCalculationModel.publish(PartyPublishedProjection.adventuringDayCalculationResult(
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
            partyMutationModel.publish(PartyPublishedProjection.mutationResult(mutation.status()));
        } catch (IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            partyMutationModel.publish(PartyPublishedProjection.storageErrorMutationResult());
        }
    }

    private void publishRepositoryBackedState(PartyRoster roster) {
        partySnapshotModel.publish(PartyPublishedProjection.snapshotResult(roster));
        activePartyModel.publish(PartyPublishedProjection.activePartyResult(roster));
        activePartyCompositionModel.publish(PartyPublishedProjection.activePartyCompositionResult(roster));
        adventuringDaySummaryModel.publish(PartyPublishedProjection.adventuringDaySummaryResult(roster));
        partyTravelPositionsModel.publish(PartyPublishedProjection.partyTravelPositionsResult(roster));
    }

    private void publishRepositoryBackedStateFromRepository() {
        try {
            publishRepositoryBackedState(repository.load());
        } catch (IllegalStateException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            partySnapshotModel.publish(PartyPublishedProjection.failedSnapshotResult());
            activePartyModel.publish(PartyPublishedProjection.failedActivePartyResult());
            activePartyCompositionModel.publish(PartyPublishedProjection.failedActivePartyCompositionResult());
            adventuringDaySummaryModel.publish(PartyPublishedProjection.failedAdventuringDaySummaryResult());
            partyTravelPositionsModel.publish(PartyPublishedProjection.failedPartyTravelPositionsResult());
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
                    new src.domain.party.model.roster.PartyTravelTile(tile.q(), tile.r(), tile.level()),
                    travelHeading(dungeon.heading()));
        }
        if (target instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return PartyTravelLocation.overworld(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private static PartyDungeonTravelLocationKind dungeonLocationKind(
            src.domain.party.published.PartyDungeonTravelLocationKind locationKind
    ) {
        return locationKind == TRANSITION ? PartyDungeonTravelLocationKind.TRANSITION : PartyDungeonTravelLocationKind.TILE;
    }

    private static PartyTravelHeading travelHeading(src.domain.party.published.PartyTravelHeading heading) {
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

    @FunctionalInterface
    private interface RosterMutationAction {

        PartyRosterMutation apply(PartyRoster roster);
    }
}
