package src.domain.party.application;

import src.domain.party.model.roster.helper.PartyAdventuringDayBudgetHelper;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.repository.PartyRosterRepository;

import java.util.ArrayList;
import java.util.List;

public final class LoadAdventuringDaySummaryUseCase {

    private final PartyRosterRepository repository;

    public LoadAdventuringDaySummaryUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public AdventuringDayStatus execute() {
        List<PartyCharacter> activeMembers = repository.load().projection().activeMembers();
        if (activeMembers.isEmpty()) {
            return new AdventuringDayStatus(List.of(), 0, 0, 0, 0, 0, List.of());
        }

        SummaryAccumulator summary = new SummaryAccumulator(activeMembers.size());
        for (PartyCharacter character : activeMembers) {
            summary.include(restCadenceFor(character));
        }
        return summary.toStatus(activeMembers);
    }

    public record AdventuringDayStatus(
            List<Integer> activeLevels,
            int remainingToShortRest,
            int remainingToLongRest,
            int consumedXp,
            int totalBudgetXp,
            int consumedPercent,
            List<RestCadence> restCadenceStatuses
    ) {
        public AdventuringDayStatus {
            activeLevels = activeLevels == null ? List.of() : List.copyOf(activeLevels);
            restCadenceStatuses = restCadenceStatuses == null ? List.of() : List.copyOf(restCadenceStatuses);
        }
    }

    private CharacterRestCadence restCadenceFor(PartyCharacter character) {
        int level = character.progress().level();
        int totalBudget = PartyAdventuringDayBudgetHelper.perCharacter(level);
        int targetXp = switch (character.progress().shortRestsTakenSinceLongRest()) {
            case 0 -> PartyAdventuringDayBudgetHelper.afterFirstShortRest(level);
            case 1 -> PartyAdventuringDayBudgetHelper.afterSecondShortRest(level);
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

    private int determineUrgency(int milestone, int xpDelta, int level) {
        if (xpDelta <= 0) {
            return RestCadence.OVERDUE;
        }
        int segmentSize = milestone == RestCadence.LONG_REST
                ? PartyAdventuringDayBudgetHelper.finalSegment(level)
                : PartyAdventuringDayBudgetHelper.perThird(level);
        int soonThreshold = Math.max(1, (int) Math.round(segmentSize * 0.25));
        return xpDelta <= soonThreshold ? RestCadence.SOON : RestCadence.NORMAL;
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

    public static final class RestCadence {

        public static final int SHORT_REST_ONE = 1;
        public static final int SHORT_REST_TWO = 2;
        public static final int LONG_REST = 3;
        public static final int NORMAL = 1;
        public static final int SOON = 2;
        public static final int OVERDUE = 3;

        private final Long characterId;
        private final int nextMilestone;
        private final int xpDelta;
        private final int urgency;

        private RestCadence(Long characterId, int nextMilestone, int xpDelta, int urgency) {
            this.characterId = characterId;
            this.nextMilestone = normalizeMilestone(nextMilestone);
            this.xpDelta = xpDelta;
            this.urgency = normalizeUrgency(urgency);
        }

        public Long characterId() {
            return characterId;
        }

        public int nextMilestone() {
            return nextMilestone;
        }

        public int xpDelta() {
            return xpDelta;
        }

        public int urgency() {
            return urgency;
        }

        boolean longRestMilestone() {
            return nextMilestone == LONG_REST;
        }

        private static int normalizeMilestone(int value) {
            return value == SHORT_REST_ONE || value == SHORT_REST_TWO ? value : LONG_REST;
        }

        private static int normalizeUrgency(int value) {
            return value == SOON || value == OVERDUE ? value : NORMAL;
        }
    }
}
