package features.party.application;

import static features.party.api.PartyDungeonTravelLocationKind.TILE;
import static features.party.api.PartyDungeonTravelLocationKind.TRANSITION;
import static features.party.api.PartyTravelHeading.EAST;
import static features.party.api.PartyTravelHeading.NORTH;
import static features.party.api.PartyTravelHeading.SOUTH;
import static features.party.api.PartyTravelHeading.WEST;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.party.domain.roster.PartyAdventuringDayBudget;
import features.party.domain.roster.PartyAdventuringDayCalculation;
import features.party.domain.roster.PartyAdventuringDayLevelProgress;
import features.party.domain.roster.PartyAdventuringDayPlan;
import features.party.domain.roster.PartyAdventuringDayProgressEvent;
import features.party.domain.roster.PartyCharacter;
import features.party.domain.roster.PartyCharacterProgress;
import features.party.domain.roster.PartyDungeonTravelLocationKind;
import features.party.domain.roster.PartyMembership;
import features.party.domain.roster.PartyMutationStatus;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.PartyRosterProjection;
import features.party.domain.roster.PartyTravelHeading;
import features.party.domain.roster.PartyTravelLocation;
import features.party.domain.roster.helper.AdventuringDayProgressCalculationHelper;
import features.party.api.ActivePartyComposition;
import features.party.api.ActivePartyCompositionResult;
import features.party.api.ActivePartyResult;
import features.party.api.AdventuringDayBudget;
import features.party.api.AdventuringDayCalculation;
import features.party.api.AdventuringDayCalculationResult;
import features.party.api.AdventuringDayPlanningSummary;
import features.party.api.AdventuringDayProgress;
import features.party.api.AdventuringDayProgressEvent;
import features.party.api.AdventuringDayProgressEventType;
import features.party.api.AdventuringDayResult;
import features.party.api.AdventuringDaySummary;
import features.party.api.MembershipState;
import features.party.api.MutationResult;
import features.party.api.MutationStatus;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyMemberDetails;
import features.party.api.PartyMemberSummary;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartySnapshot;
import features.party.api.PartySnapshotResult;
import features.party.api.PartySummary;
import features.party.api.PartyTravelLocationSnapshot;
import features.party.api.PartyTravelPositionSnapshot;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.PartyTravelTile;
import features.party.api.ReadStatus;
import features.party.api.RestCadenceStatus;
import features.party.api.RestCadenceUrgency;
import features.party.api.RestMilestone;

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

    static PartyTravelPositionsResult failedPartyTravelPositionsResult(long revision) {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null, revision);
    }

    static AdventuringDayCalculationResult failedAdventuringDayCalculationResult() {
        return new AdventuringDayCalculationResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDayCalculation(
                        new AdventuringDayBudget(0, 0, 0, 0, 0),
                        new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())),
                AdventuringDayPlanningSummary.empty());
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

    static PartyTravelPositionsResult partyTravelPositionsResult(PartyRoster roster, long revision) {
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
        return new PartyTravelPositionsResult(ReadStatus.SUCCESS, positions, partyTokenLocation, revision);
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
            features.party.domain.roster.PartyAdventuringDayProgress progress
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

    private static features.party.api.AdventuringDayLevelProgress mapLevelProgress(
            PartyAdventuringDayLevelProgress progress
    ) {
        return new features.party.api.AdventuringDayLevelProgress(
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

    private static features.party.api.PartyDungeonTravelLocationKind toPublishedDungeonLocationKind(
            PartyDungeonTravelLocationKind locationKind
    ) {
        return PartyDungeonTravelLocationKind.TRANSITION.equals(locationKind) ? TRANSITION : TILE;
    }

    private static features.party.api.PartyTravelHeading toPublishedHeading(PartyTravelHeading heading) {
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
