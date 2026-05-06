package src.data.party.runtime;

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

    public static PartyMembership toPartyMembership(@Nullable MembershipState membershipState) {
        if (membershipState == null) {
            return PartyMembership.RESERVE;
        }
        return membershipState == MembershipState.ACTIVE ? PartyMembership.ACTIVE : PartyMembership.RESERVE;
    }

    public static PartyRestType toPartyRestType(@Nullable RestType restType) {
        if (restType == null) {
            return PartyRestType.SHORT_REST;
        }
        return restType == RestType.LONG_REST ? PartyRestType.LONG_REST : PartyRestType.SHORT_REST;
    }

    public static PartyCharacterDraft toDomainDraft(@Nullable CharacterDraft draft) {
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

    public static @Nullable PartyTravelLocation toDomainTravelLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return new src.domain.party.roster.value.PartyDungeonTravelLocation(
                    dungeon.mapId(),
                    src.domain.party.roster.value.PartyDungeonTravelLocationKind.valueOf(dungeon.locationKind().name()),
                    dungeon.ownerId(),
                    new src.domain.party.roster.value.PartyTravelTile(
                            dungeon.tile().q(),
                            dungeon.tile().r(),
                            dungeon.tile().level()),
                    src.domain.party.roster.value.PartyTravelHeading.valueOf(dungeon.heading().name()));
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return new src.domain.party.roster.value.PartyOverworldTravelLocation(
                    overworld.mapId(),
                    overworld.tileId());
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
            return new PartyDungeonTravelLocationSnapshot(
                    dungeon.mapId(),
                    PartyDungeonTravelLocationKind.valueOf(dungeon.locationKind().name()),
                    dungeon.ownerId(),
                    new PartyTravelTile(
                            dungeon.tile().q(),
                            dungeon.tile().r(),
                            dungeon.tile().level()),
                    PartyTravelHeading.valueOf(dungeon.heading().name()));
        }
        if (location instanceof src.domain.party.roster.value.PartyOverworldTravelLocation overworld) {
            return new PartyOverworldTravelLocationSnapshot(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        return new RestCadenceStatus(
                status.characterId(),
                switch (status.nextMilestone()) {
                    case SHORT_REST_ONE -> RestMilestone.SHORT_REST_ONE;
                    case SHORT_REST_TWO -> RestMilestone.SHORT_REST_TWO;
                    case LONG_REST -> RestMilestone.LONG_REST;
                },
                status.xpDelta(),
                switch (status.urgency()) {
                    case NORMAL -> RestCadenceUrgency.NORMAL;
                    case SOON -> RestCadenceUrgency.SOON;
                    case OVERDUE -> RestCadenceUrgency.OVERDUE;
                });
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
        return new AdventuringDayProgress(
                progress.totalGroupXp(),
                progress.perCharacterAwardedXp(),
                progress.partySize(),
                progress.fullDays(),
                progress.totalDays(),
                progress.shortRests(),
                progress.longRests(),
                progress.levelProgressions().stream()
                        .map(PartyBoundaryProjector::mapAdventuringDayLevelProgress)
                        .toList(),
                progress.events().stream()
                        .map(PartyBoundaryProjector::mapAdventuringDayProgressEvent)
                        .toList());
    }

    private static AdventuringDayLevelProgress mapAdventuringDayLevelProgress(
            CalculateAdventuringDayUseCase.LevelProgress progress
    ) {
        return new AdventuringDayLevelProgress(
                progress.startLevel(),
                progress.endLevel(),
                progress.characterCount(),
                progress.levelUps());
    }

    private static AdventuringDayProgressEvent mapAdventuringDayProgressEvent(
            CalculateAdventuringDayUseCase.ProgressEvent event
    ) {
        return new AdventuringDayProgressEvent(
                event.groupXp(),
                AdventuringDayProgressEventType.valueOf(event.type().name()),
                event.dayNumber(),
                event.newLevel(),
                event.affectedCharacters(),
                event.partialDay());
    }

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static MembershipState toMembershipState(PartyMembership membership) {
        return membership == PartyMembership.ACTIVE ? MembershipState.ACTIVE : MembershipState.RESERVE;
    }
}
