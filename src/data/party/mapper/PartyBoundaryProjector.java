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
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.AdventuringDayProgress;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
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
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestMilestone;
import src.domain.party.model.roster.helper.PartyLevelProgressionHelper;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyDungeonTravelLocation;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyOverworldTravelLocation;
import src.domain.party.model.roster.model.PartyTravelLocation;

@SuppressWarnings({
        "PMD.ExcessiveImports",
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
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
                        new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())),
                AdventuringDayPlanningSummary.empty());
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
                        mapAdventuringDayProgress(result.progress())),
                new AdventuringDayPlanningSummary(
                        result.budget().totalXp(),
                        result.budget().firstShortRestXp(),
                        result.budget().secondShortRestXp(),
                        result.progress().shortRests(),
                        result.progress().longRests()));
    }

    public static MutationStatus mapMutationStatus(PartyMutationStatus status) {
        if (status == null) {
            return MutationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case INVALID_INPUT -> MutationStatus.INVALID_INPUT;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
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
                PartyLevelProgressionHelper.minimumXpForLevel(character.progress().level()),
                PartyLevelProgressionHelper.nextLevelXp(character.progress().level()),
                PartyLevelProgressionHelper.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyLevelProgressionHelper.readyToLevel(character.progress().level(), character.progress().currentXp()),
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
        if (location instanceof PartyDungeonTravelLocation dungeon) {
            return new PartyDungeonTravelLocationSnapshot(
                    dungeon.mapId(),
                    toPublishedDungeonLocationKind(dungeon.locationKind()),
                    dungeon.ownerId(),
                    new PartyTravelTile(dungeon.tile().q(), dungeon.tile().r(), dungeon.tile().level()),
                    toPublishedHeading(dungeon.heading()));
        }
        if (location instanceof PartyOverworldTravelLocation overworld) {
            return new PartyOverworldTravelLocationSnapshot(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        if (status == null) {
            return new RestCadenceStatus(null, RestMilestone.LONG_REST, 0, RestCadenceUrgency.NORMAL);
        }
        LoadAdventuringDaySummaryUseCase.RestMilestone milestone = status.nextMilestone();
        LoadAdventuringDaySummaryUseCase.RestCadenceUrgency urgency = status.urgency();
        return new RestCadenceStatus(
                status.characterId(),
                milestone == LoadAdventuringDaySummaryUseCase.RestMilestone.SHORT_REST_ONE
                        ? RestMilestone.SHORT_REST_ONE
                        : milestone == LoadAdventuringDaySummaryUseCase.RestMilestone.SHORT_REST_TWO
                                ? RestMilestone.SHORT_REST_TWO
                                : RestMilestone.LONG_REST,
                status.xpDelta(),
                urgency == LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.SOON
                        ? RestCadenceUrgency.SOON
                        : urgency == LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.OVERDUE
                                ? RestCadenceUrgency.OVERDUE
                                : RestCadenceUrgency.NORMAL);
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
        CalculateAdventuringDayUseCase.Progress safeProgress = progress == null
                ? new CalculateAdventuringDayUseCase.Progress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())
                : progress;
        return new AdventuringDayProgress(
                safeProgress.totalGroupXp(),
                safeProgress.perCharacterAwardedXp(),
                safeProgress.partySize(),
                safeProgress.fullDays(),
                safeProgress.totalDays(),
                safeProgress.shortRests(),
                safeProgress.longRests(),
                safeProgress.levelProgressions().stream()
                        .map(levelProgress -> new AdventuringDayLevelProgress(
                                levelProgress.startLevel(),
                                levelProgress.endLevel(),
                                levelProgress.characterCount(),
                                levelProgress.levelUps()))
                        .toList(),
                safeProgress.events().stream()
                        .map(event -> new AdventuringDayProgressEvent(
                                event.groupXp(),
                                toPublishedProgressEventType(event.type()),
                                event.dayNumber(),
                                event.newLevel(),
                                event.affectedCharacters(),
                                event.partialDay()))
                        .toList());
    }

    private static AdventuringDayProgressEventType toPublishedProgressEventType(
            CalculateAdventuringDayUseCase.ProgressEventType type
    ) {
        if (type == CalculateAdventuringDayUseCase.ProgressEventType.LEVEL_UP) {
            return AdventuringDayProgressEventType.LEVEL_UP;
        }
        if (type == CalculateAdventuringDayUseCase.ProgressEventType.SHORT_REST) {
            return AdventuringDayProgressEventType.SHORT_REST;
        }
        return AdventuringDayProgressEventType.LONG_REST;
    }

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static MembershipState toMembershipState(PartyMembership membership) {
        return membership == PartyMembership.ACTIVE ? MembershipState.ACTIVE : MembershipState.RESERVE;
    }

    private static PartyDungeonTravelLocationKind toPublishedDungeonLocationKind(
            src.domain.party.model.roster.model.PartyDungeonTravelLocationKind locationKind
    ) {
        return PartyDungeonTravelLocationKind.valueOf(locationKind.name());
    }

    private static PartyTravelHeading toPublishedHeading(
            src.domain.party.model.roster.model.PartyTravelHeading heading
    ) {
        return PartyTravelHeading.valueOf(heading.name());
    }
}
