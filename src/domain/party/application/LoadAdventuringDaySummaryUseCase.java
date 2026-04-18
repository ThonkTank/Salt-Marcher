package src.domain.party.application;

import src.domain.party.roster.PartyCharacter;
import src.domain.party.roster.PartyRosterRepository;
import src.domain.party.roster.PartyAdventuringDayBudget;

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

    public enum RestMilestone {
        SHORT_REST_ONE,
        SHORT_REST_TWO,
        LONG_REST
    }

    public enum RestCadenceUrgency {
        NORMAL,
        SOON,
        OVERDUE
    }

    public record RestCadenceStatus(
            Long characterId,
            RestMilestone nextMilestone,
            int xpDelta,
            RestCadenceUrgency urgency
    ) {
    }

    public record AdventuringDayStatus(
            List<Integer> activeLevels,
            int remainingToShortRest,
            int remainingToLongRest,
            int consumedXp,
            int totalBudgetXp,
            int consumedPercent,
            List<RestCadenceStatus> restCadenceStatuses
    ) {
        public AdventuringDayStatus {
            activeLevels = activeLevels == null ? List.of() : List.copyOf(activeLevels);
            restCadenceStatuses = restCadenceStatuses == null ? List.of() : List.copyOf(restCadenceStatuses);
        }
    }

    private CharacterRestCadence restCadenceFor(PartyCharacter character) {
        int level = character.progress().level();
        int totalBudget = PartyAdventuringDayBudget.perCharacter(level);
        int targetXp = switch (character.progress().shortRestsTakenSinceLongRest()) {
            case 0 -> PartyAdventuringDayBudget.afterFirstShortRest(level);
            case 1 -> PartyAdventuringDayBudget.afterSecondShortRest(level);
            default -> totalBudget;
        };
        RestMilestone nextMilestone = switch (character.progress().shortRestsTakenSinceLongRest()) {
            case 0 -> RestMilestone.SHORT_REST_ONE;
            case 1 -> RestMilestone.SHORT_REST_TWO;
            default -> RestMilestone.LONG_REST;
        };
        int xpSinceLongRest = character.progress().xpSinceLongRest();
        int xpDelta = targetXp - xpSinceLongRest;
        return new CharacterRestCadence(
                new RestCadenceStatus(character.id(), nextMilestone, xpDelta, determineUrgency(nextMilestone, xpDelta, level)),
                totalBudget,
                xpSinceLongRest);
    }

    private RestCadenceUrgency determineUrgency(RestMilestone milestone, int xpDelta, int level) {
        if (xpDelta <= 0) {
            return RestCadenceUrgency.OVERDUE;
        }
        int segmentSize = switch (milestone) {
            case SHORT_REST_ONE, SHORT_REST_TWO -> PartyAdventuringDayBudget.perThird(level);
            case LONG_REST -> PartyAdventuringDayBudget.finalSegment(level);
        };
        int soonThreshold = Math.max(1, (int) Math.round(segmentSize * 0.25));
        return xpDelta <= soonThreshold ? RestCadenceUrgency.SOON : RestCadenceUrgency.NORMAL;
    }

    private static final class SummaryAccumulator {

        private final int activeMemberCount;
        private double remainingToShortRest;
        private double remainingToLongRest;
        private int shortRestPendingCount;
        private int consumedXp;
        private int totalBudgetXp;
        private final List<RestCadenceStatus> restCadenceStatuses = new ArrayList<>();

        private SummaryAccumulator(int activeMemberCount) {
            this.activeMemberCount = activeMemberCount;
        }

        private void include(CharacterRestCadence cadence) {
            if (cadence.status().nextMilestone() != RestMilestone.LONG_REST) {
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
                    activeMembers.stream().map(character -> character.progress().level()).toList(),
                    shortRestPendingCount == 0 ? 0 : (int) Math.round(remainingToShortRest / shortRestPendingCount),
                    (int) Math.round(remainingToLongRest / activeMemberCount),
                    consumedXp,
                    totalBudgetXp,
                    totalBudgetXp <= 0 ? 0 : (int) Math.round((consumedXp * 100.0) / totalBudgetXp),
                    restCadenceStatuses);
        }
    }

    private record CharacterRestCadence(
            RestCadenceStatus status,
            int totalBudget,
            int xpSinceLongRest
    ) {
    }
}
