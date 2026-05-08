package src.data.party.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.LoadActivePartyCompositionUseCase;
import src.domain.party.application.LoadAdventuringDaySummaryUseCase;
import src.domain.party.application.LoadPartySnapshotUseCase;
import src.domain.party.application.LoadPartyTravelPositionsUseCase;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayBudget;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayLevelProgress;
import src.domain.party.published.AdventuringDayProgress;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestMilestone;
import src.domain.party.published.RestType;
import src.domain.party.roster.entity.PartyCharacter;
import src.domain.party.roster.policy.PartyLevelProgressionPolicy;
import src.domain.party.roster.value.PartyCharacterDraft;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyMutationStatus;
import src.domain.party.roster.value.PartyRestType;
import src.domain.party.roster.value.PartyTravelLocation;

public final class PartyBoundaryProjector {

    private PartyBoundaryProjector() {
    }

    public static PartySnapshotResult failedSnapshotResult() {
        return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
    }

    public static ActivePartyResult failedActivePartyResult() {
        return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
    }

    public static ActivePartyCompositionResult failedActivePartyCompositionResult() {
        return new ActivePartyCompositionResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyComposition(List.of(), 1));
    }

    public static AdventuringDayResult failedAdventuringDaySummaryResult() {
        return new AdventuringDayResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    }

    public static PartyTravelPositionsResult failedPartyTravelPositionsResult() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null);
    }

    public static MutationResult defaultMutationResult() {
        return new MutationResult(MutationStatus.SUCCESS);
    }

    public static MutationResult storageErrorMutationResult() {
        return new MutationResult(MutationStatus.STORAGE_ERROR);
    }

    public static AdventuringDayCalculationResult failedAdventuringDayCalculationResult() {
        return new AdventuringDayCalculationResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDayCalculation(
                        new AdventuringDayBudget(0, 0, 0, 0, 0),
                        new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())));
    }

    public static PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new PartySnapshot(
                projection.activeMembers().stream().map(PartyBoundaryProjector::mapDetails).toList(),
                projection.reserveMembers().stream().map(PartyBoundaryProjector::mapDetails).toList(),
                new PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
    }

    public static ActivePartyResult mapActivePartyResult(List<PartyCharacter> activeMembers) {
        return new ActivePartyResult(
                ReadStatus.SUCCESS,
                activeMembers.stream().map(PartyBoundaryProjector::mapSummary).toList());
    }

    public static ActivePartyCompositionResult mapActivePartyCompositionResult(
            LoadActivePartyCompositionUseCase.ActiveComposition composition
    ) {
        return new ActivePartyCompositionResult(
                ReadStatus.SUCCESS,
                new ActivePartyComposition(composition.activePartyLevels(), composition.averageActiveLevel()));
    }

    public static AdventuringDayResult mapAdventuringDaySummaryResult(
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus
    ) {
        return new AdventuringDayResult(
                ReadStatus.SUCCESS,
                new AdventuringDaySummary(
                        dayStatus.activeLevels(),
                        dayStatus.remainingToShortRest(),
                        dayStatus.remainingToLongRest(),
                        dayStatus.consumedXp(),
                        dayStatus.totalBudgetXp(),
                        dayStatus.consumedPercent(),
                        dayStatus.restCadenceStatuses().stream()
                                .map(PartyBoundaryProjector::mapRestCadenceStatus)
                                .toList()));
    }

    public static PartyTravelPositionsResult mapTravelPositionsResult(LoadPartyTravelPositionsUseCase.Result result) {
        return new PartyTravelPositionsResult(
                ReadStatus.SUCCESS,
                result.positions().stream()
                        .map(PartyBoundaryProjector::mapTravelPosition)
                        .toList(),
                mapTravelLocation(result.partyTokenLocation()));
    }

    public static AdventuringDayCalculationResult mapAdventuringDayCalculationResult(
            CalculateAdventuringDayUseCase.Result result
    ) {
        return new AdventuringDayCalculationResult(
                ReadStatus.SUCCESS,
                new AdventuringDayCalculation(
                        mapAdventuringDayBudget(result.budget()),
                        mapAdventuringDayProgress(result.progress())));
    }

    public static MutationStatus mapMutationStatus(PartyMutationStatus status) {
        return MutationStatus.fromInternal(status);
    }

    public static PartyMembership toPartyMembership(@Nullable MembershipState membershipState) {
        return membershipState == null ? PartyMembership.RESERVE : membershipState.toInternal();
    }

    public static PartyRestType toPartyRestType(@Nullable RestType restType) {
        return restType == null ? PartyRestType.SHORT_REST : restType.toInternal();
    }

    public static PartyCharacterDraft toDomainDraft(@Nullable CharacterDraft draft) {
        return draft == null ? new PartyCharacterDraft("", "", 0, 0, 0) : draft.toInternal();
    }

    public static @Nullable PartyTravelLocation toDomainTravelLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return dungeon.toInternal();
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return overworld.toInternal();
        }
        return null;
    }

    private static PartyMemberSummary mapSummary(PartyCharacter character) {
        return new PartyMemberSummary(
                character.id(),
                character.identity().name(),
                character.progress().level());
    }

    private static PartyMemberDetails mapDetails(PartyCharacter character) {
        return new PartyMemberDetails(
                character.id(),
                character.identity().name(),
                character.identity().playerName(),
                character.progress().level(),
                character.progress().currentXp(),
                PartyLevelProgressionPolicy.minimumXpForLevel(character.progress().level()),
                PartyLevelProgressionPolicy.nextLevelXp(character.progress().level()),
                PartyLevelProgressionPolicy.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyLevelProgressionPolicy.readyToLevel(character.progress().level(), character.progress().currentXp()),
                character.combat().passivePerception(),
                character.combat().armorClass(),
                character.progress().xpSinceShortRest(),
                character.progress().xpSinceLongRest(),
                character.progress().shortRestsTakenSinceLongRest(),
                toMembershipState(character.membership()));
    }

    private static PartyTravelPositionSnapshot mapTravelPosition(LoadPartyTravelPositionsUseCase.TravelPosition position) {
        return new PartyTravelPositionSnapshot(
                position.characterId(),
                position.attachedToPartyToken(),
                mapTravelLocation(position.location()));
    }

    private static @Nullable PartyTravelLocationSnapshot mapTravelLocation(@Nullable PartyTravelLocation location) {
        if (location instanceof src.domain.party.roster.value.PartyDungeonTravelLocation dungeon) {
            return PartyDungeonTravelLocationSnapshot.fromInternal(dungeon);
        }
        if (location instanceof src.domain.party.roster.value.PartyOverworldTravelLocation overworld) {
            return PartyOverworldTravelLocationSnapshot.fromInternal(overworld);
        }
        return null;
    }

    private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        return RestCadenceStatus.fromInternal(status);
    }

    private static AdventuringDayBudget mapAdventuringDayBudget(CalculateAdventuringDayUseCase.Budget budget) {
        return new AdventuringDayBudget(
                budget.totalXp(),
                budget.perThirdXp(),
                budget.firstShortRestXp(),
                budget.secondShortRestXp(),
                budget.characterCount());
    }

    private static AdventuringDayProgress mapAdventuringDayProgress(CalculateAdventuringDayUseCase.Progress progress) {
        return AdventuringDayProgress.fromInternal(progress);
    }

    private static AdventuringDayLevelProgress mapAdventuringDayLevelProgress(
            CalculateAdventuringDayUseCase.LevelProgress progress
    ) {
        return AdventuringDayLevelProgress.fromInternal(progress);
    }

    private static AdventuringDayProgressEvent mapAdventuringDayProgressEvent(
            CalculateAdventuringDayUseCase.ProgressEvent event
    ) {
        return AdventuringDayProgressEvent.fromInternal(event);
    }

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static MembershipState toMembershipState(PartyMembership membership) {
        return MembershipState.fromInternal(membership);
    }
}
