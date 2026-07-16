package src.domain.party;

import static src.domain.party.published.PartyDungeonTravelLocationKind.TILE;
import static src.domain.party.published.PartyDungeonTravelLocationKind.TRANSITION;
import static src.domain.party.published.PartyTravelHeading.EAST;
import static src.domain.party.published.PartyTravelHeading.NORTH;
import static src.domain.party.published.PartyTravelHeading.SOUTH;
import static src.domain.party.published.PartyTravelHeading.WEST;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyAdventuringDayBudget;
import src.domain.party.model.roster.PartyAdventuringDayCalculation;
import src.domain.party.model.roster.PartyAdventuringDayLevelProgress;
import src.domain.party.model.roster.PartyAdventuringDayPlan;
import src.domain.party.model.roster.PartyAdventuringDayProgressEvent;
import src.domain.party.model.roster.PartyCharacter;
import src.domain.party.model.roster.PartyCharacterProgress;
import src.domain.party.model.roster.PartyDungeonTravelLocationKind;
import src.domain.party.model.roster.PartyMembership;
import src.domain.party.model.roster.PartyMutationStatus;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterProjection;
import src.domain.party.model.roster.PartyTravelHeading;
import src.domain.party.model.roster.PartyTravelLocation;
import src.domain.party.model.roster.helper.AdventuringDayProgressCalculationHelper;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayBudget;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.AdventuringDayProgress;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestMilestone;

final class PartyPublishedProjection {

    private PartyPublishedProjection() {
    }

    static PartySnapshotResult failedSnapshotResult() {
        return new PartySnapshotResult(
                ReadStatus.STORAGE_ERROR,
                new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1)));
    }

    static ActivePartyResult failedActivePartyResult() {
        return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
    }

    static ActivePartyCompositionResult failedActivePartyCompositionResult() {
        return new ActivePartyCompositionResult(
                ReadStatus.STORAGE_ERROR,
                new ActivePartyComposition(List.of(), 1));
    }

    static AdventuringDayResult failedAdventuringDaySummaryResult() {
        return new AdventuringDayResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    }

    static PartyTravelPositionsResult failedPartyTravelPositionsResult() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null);
    }

    static MutationResult storageErrorMutationResult() {
        return new MutationResult(MutationStatus.STORAGE_ERROR);
    }

    static PartySnapshotResult snapshotResult(PartyRoster roster) {
        PartyRosterProjection projection = roster.projection();
        return new PartySnapshotResult(
                ReadStatus.SUCCESS,
                new PartySnapshot(
                        projection.activeMembers().stream().map(PartyPublishedProjection::mapDetails).toList(),
                        projection.reserveMembers().stream().map(PartyPublishedProjection::mapDetails).toList(),
                        new PartySummary(
                                projection.activeMembers().size(),
                                projection.reserveMembers().size(),
                                projection.averageActiveLevel())));
    }

    static ActivePartyResult activePartyResult(PartyRoster roster) {
        return new ActivePartyResult(
                ReadStatus.SUCCESS,
                roster.projection().activeMembers().stream().map(PartyPublishedProjection::mapSummary).toList());
    }

    static ActivePartyCompositionResult activePartyCompositionResult(PartyRoster roster) {
        PartyRosterProjection projection = roster.projection();
        return new ActivePartyCompositionResult(
                ReadStatus.SUCCESS,
                new ActivePartyComposition(
                        projection.activeLevelsByComposition(),
                        projection.averageActiveLevel()));
    }

    static AdventuringDayResult adventuringDaySummaryResult(PartyRoster roster) {
        return mapAdventuringDaySummaryResult(adventuringDayStatus(roster.projection().activeMembers()));
    }

    static PartyTravelPositionsResult partyTravelPositionsResult(PartyRoster roster) {
        List<PartyTravelPositionSnapshot> positions = new ArrayList<>();
        @Nullable PartyTravelLocationSnapshot partyTokenLocation = null;
        for (PartyCharacter character : roster.characters()) {
            PartyTravelLocationSnapshot location = mapTravelLocation(character.travel().location());
            positions.add(new PartyTravelPositionSnapshot(
                    character.id(),
                    character.travel().attachedToPartyToken(),
                    location));
            if (partyTokenLocation == null && character.travel().attachedToPartyToken() && location != null) {
                partyTokenLocation = location;
            }
        }
        return new PartyTravelPositionsResult(ReadStatus.SUCCESS, positions, partyTokenLocation);
    }

    static MutationResult mutationResult(PartyMutationStatus status) {
        return new MutationResult(mutationStatus(status));
    }

    static AdventuringDayCalculationResult adventuringDayCalculationResult(
            List<Integer> levels,
            int totalGroupXp,
            AdventuringDayProgressCalculationHelper progress
    ) {
        List<Integer> normalizedLevels = normalizeLevels(levels);
        PartyAdventuringDayCalculation calculation = new PartyAdventuringDayCalculation(
                PartyAdventuringDayPlan.forLevels(normalizedLevels),
                progress.compute(normalizedLevels, Math.max(0, totalGroupXp)));
        return mapAdventuringDayCalculationResult(calculation);
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
                PartyCharacterProgress.minimumXpForLevel(character.progress().level()),
                PartyCharacterProgress.nextLevelXp(character.progress().level()),
                PartyCharacterProgress.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyCharacterProgress.readyToLevel(character.progress().level(), character.progress().currentXp()),
                character.combat().passivePerception(),
                character.combat().armorClass(),
                character.progress().xpSinceShortRest(),
                character.progress().xpSinceLongRest(),
                character.progress().shortRestsTakenSinceLongRest(),
                toMembershipState(character.membership()));
    }

    private static MembershipState toMembershipState(PartyMembership membership) {
        return PartyMembership.ACTIVE.equals(membership) ? MembershipState.ACTIVE : MembershipState.RESERVE;
    }

    private static AdventuringDayStatus adventuringDayStatus(List<PartyCharacter> activeMembers) {
        if (activeMembers.isEmpty()) {
            return new AdventuringDayStatus(List.of(), 0, 0, 0, 0, 0, List.of());
        }
        SummaryAccumulator summary = new SummaryAccumulator(activeMembers.size());
        for (PartyCharacter character : activeMembers) {
            summary.include(restCadenceFor(character));
        }
        return summary.toStatus(activeMembers);
    }

    private static CharacterRestCadence restCadenceFor(PartyCharacter character) {
        int level = character.progress().level();
        PartyAdventuringDayBudget budget = PartyAdventuringDayBudget.forLevel(level);
        int totalBudget = budget.perCharacter();
        int targetXp = switch (character.progress().shortRestsTakenSinceLongRest()) {
            case 0 -> budget.afterFirstShortRest();
            case 1 -> budget.afterSecondShortRest();
            default -> totalBudget;
        };
        int nextMilestone = switch (character.progress().shortRestsTakenSinceLongRest()) {
            case 0 -> RestCadence.SHORT_REST_ONE;
            case 1 -> RestCadence.SHORT_REST_TWO;
            default -> RestCadence.LONG_REST;
        };
        int xpSinceLongRest = character.progress().xpSinceLongRest();
        int xpDelta = targetXp - xpSinceLongRest;
        return new CharacterRestCadence(
                new RestCadence(character.id(), nextMilestone, xpDelta, determineUrgency(nextMilestone, xpDelta, level)),
                totalBudget,
                xpSinceLongRest);
    }

    private static int determineUrgency(int milestone, int xpDelta, int level) {
        if (xpDelta <= 0) {
            return RestCadence.OVERDUE;
        }
        PartyAdventuringDayBudget budget = PartyAdventuringDayBudget.forLevel(level);
        int segmentSize = milestone == RestCadence.LONG_REST ? budget.finalSegment() : budget.perThird();
        int soonThreshold = Math.max(1, (int) Math.round(segmentSize * 0.25));
        return xpDelta <= soonThreshold ? RestCadence.SOON : RestCadence.NORMAL;
    }

    private static AdventuringDayResult mapAdventuringDaySummaryResult(AdventuringDayStatus dayStatus) {
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
                                .map(PartyPublishedProjection::mapRestCadenceStatus)
                                .toList()));
    }

    private static RestCadenceStatus mapRestCadenceStatus(RestCadence status) {
        if (status == null) {
            return new RestCadenceStatus(
                    null,
                    RestMilestone.LONG_REST,
                    0,
                    RestCadenceUrgency.NORMAL);
        }
        return new RestCadenceStatus(
                status.characterId(),
                toPublishedRestMilestone(status.nextMilestone()),
                status.xpDelta(),
                toPublishedRestCadenceUrgency(status.urgency()));
    }

    private static AdventuringDayCalculationResult mapAdventuringDayCalculationResult(
            PartyAdventuringDayCalculation calculation
    ) {
        AdventuringDayCalculation publishedCalculation = new AdventuringDayCalculation(
                mapAdventuringDayBudget(calculation.plan()),
                mapAdventuringDayProgress(calculation.progress()));
        return new AdventuringDayCalculationResult(
                ReadStatus.SUCCESS,
                publishedCalculation,
                new AdventuringDayPlanningSummary(
                        calculation.plan().totalBudgetXp(),
                        calculation.plan().firstShortRestXp(),
                        calculation.plan().secondShortRestXp(),
                        calculation.plannedShortRests(),
                        calculation.plannedLongRests()));
    }

    private static AdventuringDayBudget mapAdventuringDayBudget(PartyAdventuringDayPlan plan) {
        return new AdventuringDayBudget(
                plan.totalBudgetXp(),
                plan.perThirdXp(),
                plan.firstShortRestXp(),
                plan.secondShortRestXp(),
                plan.characterCount());
    }

    private static AdventuringDayProgress mapAdventuringDayProgress(
            src.domain.party.model.roster.PartyAdventuringDayProgress progress
    ) {
        return new AdventuringDayProgress(
                progress.totals().totalGroupXp(),
                progress.totals().perCharacterAwardedXp(),
                progress.totals().partySize(),
                progress.longRests(),
                progress.totals().totalDays(),
                progress.shortRests(),
                progress.longRests(),
                progress.levelProgressions().stream()
                        .map(PartyPublishedProjection::mapLevelProgress)
                        .toList(),
                progress.events().stream()
                        .map(PartyPublishedProjection::mapProgressEvent)
                        .toList());
    }

    private static src.domain.party.published.AdventuringDayLevelProgress mapLevelProgress(
            PartyAdventuringDayLevelProgress progress
    ) {
        return new src.domain.party.published.AdventuringDayLevelProgress(
                progress.startLevel(),
                progress.endLevel(),
                progress.characterCount(),
                progress.levelUps());
    }

    private static AdventuringDayProgressEvent mapProgressEvent(PartyAdventuringDayProgressEvent event) {
        return new AdventuringDayProgressEvent(
                event.groupXp(),
                toPublishedProgressEventType(event),
                event.dayNumber(),
                event.newLevel(),
                event.affectedCharacters(),
                event.partialDay());
    }

    private static AdventuringDayProgressEventType toPublishedProgressEventType(
            PartyAdventuringDayProgressEvent event
    ) {
        if (event.isLevelUp()) {
            return AdventuringDayProgressEventType.LEVEL_UP;
        }
        if (event.isShortRest()) {
            return AdventuringDayProgressEventType.SHORT_REST;
        }
        return AdventuringDayProgressEventType.LONG_REST;
    }

    private static @Nullable PartyTravelLocationSnapshot mapTravelLocation(@Nullable PartyTravelLocation location) {
        if (location != null && location.isDungeon()) {
            return new PartyDungeonTravelLocationSnapshot(
                    location.mapId(),
                    toPublishedDungeonLocationKind(location.dungeonLocationKind()),
                    location.dungeonOwnerId(),
                    new PartyTravelTile(
                            location.dungeonTile().q(),
                            location.dungeonTile().r(),
                            location.dungeonTile().level()),
                    toPublishedHeading(location.dungeonHeading()));
        }
        if (location != null && location.isOverworld()) {
            return new PartyOverworldTravelLocationSnapshot(location.mapId(), location.overworldTileId());
        }
        return null;
    }

    private static src.domain.party.published.PartyDungeonTravelLocationKind toPublishedDungeonLocationKind(
            PartyDungeonTravelLocationKind locationKind
    ) {
        return PartyDungeonTravelLocationKind.TRANSITION.equals(locationKind) ? TRANSITION : TILE;
    }

    private static src.domain.party.published.PartyTravelHeading toPublishedHeading(PartyTravelHeading heading) {
        if (PartyTravelHeading.NORTH.equals(heading)) {
            return NORTH;
        }
        if (PartyTravelHeading.EAST.equals(heading)) {
            return EAST;
        }
        if (PartyTravelHeading.WEST.equals(heading)) {
            return WEST;
        }
        return SOUTH;
    }

    private static MutationStatus mutationStatus(PartyMutationStatus status) {
        if (status == null) {
            return MutationStatus.STORAGE_ERROR;
        }
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            return MutationStatus.SUCCESS;
        }
        if (PartyMutationStatus.NOT_FOUND.equals(status)) {
            return MutationStatus.NOT_FOUND;
        }
        if (PartyMutationStatus.INVALID_INPUT.equals(status)) {
            return MutationStatus.INVALID_INPUT;
        }
        return MutationStatus.STORAGE_ERROR;
    }

    private static RestMilestone toPublishedRestMilestone(int milestone) {
        if (milestone == RestCadence.SHORT_REST_ONE) {
            return RestMilestone.SHORT_REST_ONE;
        }
        if (milestone == RestCadence.SHORT_REST_TWO) {
            return RestMilestone.SHORT_REST_TWO;
        }
        return RestMilestone.LONG_REST;
    }

    private static RestCadenceUrgency toPublishedRestCadenceUrgency(int urgency) {
        if (urgency == RestCadence.OVERDUE) {
            return RestCadenceUrgency.OVERDUE;
        }
        if (urgency == RestCadence.SOON) {
            return RestCadenceUrgency.SOON;
        }
        return RestCadenceUrgency.NORMAL;
    }

    private static List<Integer> normalizeLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        List<Integer> normalized = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                normalized.add(PartyCharacterProgress.clampLevel(level));
            }
        }
        return List.copyOf(normalized);
    }

    private static final class SummaryAccumulator {

        private final int activeMemberCount;
        private double remainingToShortRest;
        private double remainingToLongRest;
        private int shortRestPendingCount;
        private int consumedXp;
        private int totalBudgetXp;
        private final List<RestCadence> restCadenceStatuses = new ArrayList<>();

        private SummaryAccumulator(int activeMemberCount) {
            this.activeMemberCount = activeMemberCount;
        }

        private void include(CharacterRestCadence cadence) {
            if (!cadence.status().longRestMilestone()) {
                remainingToShortRest += Math.max(0, cadence.status().xpDelta());
                shortRestPendingCount++;
            }
            remainingToLongRest += Math.max(0, cadence.totalBudget() - cadence.xpSinceLongRest());
            consumedXp += Math.max(0, cadence.xpSinceLongRest());
            totalBudgetXp += cadence.totalBudget();
            restCadenceStatuses.add(cadence.status());
        }

        private AdventuringDayStatus toStatus(List<PartyCharacter> activeMembers) {
            return new AdventuringDayStatus(
                    activeLevels(activeMembers),
                    shortRestPendingCount == 0 ? 0 : (int) Math.round(remainingToShortRest / shortRestPendingCount),
                    (int) Math.round(remainingToLongRest / activeMemberCount),
                    consumedXp,
                    totalBudgetXp,
                    totalBudgetXp <= 0 ? 0 : (int) Math.round(consumedXp * 100.0 / totalBudgetXp),
                    restCadenceStatuses);
        }

        private static List<Integer> activeLevels(List<PartyCharacter> activeMembers) {
            List<Integer> levels = new ArrayList<>(activeMembers.size());
            for (PartyCharacter character : activeMembers) {
                levels.add(character.progress().level());
            }
            return List.copyOf(levels);
        }
    }

    private record CharacterRestCadence(
            RestCadence status,
            int totalBudget,
            int xpSinceLongRest
    ) {
    }

    private record AdventuringDayStatus(
            List<Integer> activeLevels,
            int remainingToShortRest,
            int remainingToLongRest,
            int consumedXp,
            int totalBudgetXp,
            int consumedPercent,
            List<RestCadence> restCadenceStatuses
    ) {
        private AdventuringDayStatus {
            activeLevels = activeLevels == null ? List.of() : List.copyOf(activeLevels);
            restCadenceStatuses = restCadenceStatuses == null ? List.of() : List.copyOf(restCadenceStatuses);
        }
    }

    private record RestCadence(
            Long characterId,
            int nextMilestone,
            int xpDelta,
            int urgency
    ) {

        private static final int SHORT_REST_ONE = 1;
        private static final int SHORT_REST_TWO = 2;
        private static final int LONG_REST = 3;
        private static final int NORMAL = 1;
        private static final int SOON = 2;
        private static final int OVERDUE = 3;

        private RestCadence {
            nextMilestone = nextMilestone == SHORT_REST_ONE || nextMilestone == SHORT_REST_TWO
                    ? nextMilestone
                    : LONG_REST;
            urgency = urgency == SOON || urgency == OVERDUE ? urgency : NORMAL;
        }

        private boolean longRestMilestone() {
            return nextMilestone == LONG_REST;
        }
    }

}
