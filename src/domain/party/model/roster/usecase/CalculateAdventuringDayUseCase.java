package src.domain.party.model.roster.usecase;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.model.PartyAdventuringDayCalculation;
import src.domain.party.model.roster.model.PartyAdventuringDayLevelProgress;
import src.domain.party.model.roster.model.PartyAdventuringDayPlan;
import src.domain.party.model.roster.model.PartyAdventuringDayProgress;
import src.domain.party.model.roster.model.PartyAdventuringDayProgressEvent;
import src.domain.party.model.roster.model.PartyAdventuringDayProgressTotals;
import src.domain.party.model.roster.model.PartyCharacterProgress;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;

public final class CalculateAdventuringDayUseCase {

    private final @Nullable PartyPublishedStateRepository publishedStateRepository;

    public CalculateAdventuringDayUseCase() {
        this.publishedStateRepository = null;
    }

    public CalculateAdventuringDayUseCase(PartyPublishedStateRepository publishedStateRepository) {
        this.publishedStateRepository = java.util.Objects.requireNonNull(
                publishedStateRepository,
                "publishedStateRepository");
    }

    public void publish(List<Integer> levels, int totalGroupXp) {
        if (publishedStateRepository == null) {
            throw new IllegalStateException("publishedStateRepository");
        }
        PartyPublishedStateRepository publisher = publishedStateRepository;
        publisher.publishAdventuringDayCalculation(
                new PartyPublishedStateRepository.AdventuringDayCalculationPublication(levels, totalGroupXp));
    }

    public PartyAdventuringDayCalculation execute(List<Integer> levels, int totalGroupXp) {
        List<Integer> normalizedLevels = normalizeLevels(levels);
        return new PartyAdventuringDayCalculation(
                computeBudget(normalizedLevels),
                computeProgress(normalizedLevels, Math.max(0, totalGroupXp)));
    }

    private static PartyAdventuringDayPlan computeBudget(List<Integer> levels) {
        return PartyAdventuringDayPlan.forLevels(levels);
    }

    private static PartyAdventuringDayProgress computeProgress(List<Integer> levels, int totalGroupXp) {
        if (levels.isEmpty()) {
            return PartyAdventuringDayProgress.empty(totalGroupXp);
        }

        int partySize = levels.size();
        int perCharacterAwardedXp = totalGroupXp / partySize;
        List<PartyAdventuringDayLevelProgress> levelProgressions =
                buildLevelProgressions(levels, perCharacterAwardedXp);
        List<PartyAdventuringDayProgressEvent> events = new ArrayList<>();

        int[] startLevels = toLevelArray(levels);
        int[] currentLevels = toLevelArray(levels);
        int consumedGroupXp = 0;
        int remainingGroupXp = totalGroupXp;
        int dayNumber = 1;
        double totalDays = 0.0;

        while (remainingGroupXp > 0) {
            List<Integer> dayLevels = new ArrayList<>(partySize);
            for (int level : currentLevels) {
                dayLevels.add(level);
            }
            PartyAdventuringDayPlan dayBudget = computeBudget(dayLevels);
            int dayTotalXp = Math.max(1, dayBudget.totalBudgetXp());
            int dayConsumedXp = Math.min(remainingGroupXp, dayTotalXp);
            int dayStartXp = consumedGroupXp;
            int dayEndXp = dayStartXp + dayConsumedXp;
            boolean partialDay = dayConsumedXp < dayTotalXp;

            if (dayConsumedXp >= dayBudget.firstShortRestXp()) {
                events.add(PartyAdventuringDayProgressEvent.shortRest(
                        dayStartXp + dayBudget.firstShortRestXp(),
                        dayNumber,
                        partialDay));
            }
            if (dayConsumedXp >= dayBudget.secondShortRestXp()) {
                events.add(PartyAdventuringDayProgressEvent.shortRest(
                        dayStartXp + dayBudget.secondShortRestXp(),
                        dayNumber,
                        partialDay));
            }

            appendLevelUpEvents(events, startLevels, currentLevels, partySize, dayNumber, dayStartXp, dayEndXp, partialDay);

            if (!partialDay) {
                events.add(PartyAdventuringDayProgressEvent.longRest(
                        dayEndXp,
                        dayNumber));
            }

            totalDays += dayConsumedXp / (double) dayTotalXp;
            consumedGroupXp = dayEndXp;
            remainingGroupXp -= dayConsumedXp;
            dayNumber++;
        }

        return new PartyAdventuringDayProgress(
                new PartyAdventuringDayProgressTotals(totalGroupXp, perCharacterAwardedXp, partySize, totalDays),
                levelProgressions,
                List.copyOf(events));
    }

    private static List<PartyAdventuringDayLevelProgress> buildLevelProgressions(
            List<Integer> levels,
            int perCharacterAwardedXp
    ) {
        Map<LevelSpan, Integer> counts = new LinkedHashMap<>();
        for (Integer level : levels) {
            int endLevel = levelAfterAwardedXp(level, perCharacterAwardedXp);
            LevelSpan span = new LevelSpan(level, endLevel);
            Integer currentCount = counts.get(span);
            counts.put(span, currentCount == null ? 1 : currentCount + 1);
        }
        List<PartyAdventuringDayLevelProgress> result = new ArrayList<>();
        for (Map.Entry<LevelSpan, Integer> entry : counts.entrySet()) {
            LevelSpan span = entry.getKey();
            result.add(new PartyAdventuringDayLevelProgress(
                    span.startLevel(),
                    span.endLevel(),
                    entry.getValue()));
        }
        return List.copyOf(result);
    }

    private static int levelAfterAwardedXp(int startLevel, int perCharacterAwardedXp) {
        int totalXp = PartyCharacterProgress.minimumXpForLevel(startLevel);
        int level = startLevel;
        while (level < 20
                && totalXp + perCharacterAwardedXp >= PartyCharacterProgress.minimumXpForLevel(level + 1)) {
            level++;
        }
        return level;
    }

    private static void appendLevelUpEvents(
            List<PartyAdventuringDayProgressEvent> events,
            int[] startLevels,
            int[] currentLevels,
            int partySize,
            int dayNumber,
            int dayStartXp,
            int dayEndXp,
            boolean partialDay) {
        Map<BreakpointLevel, Integer> groupedEvents = new TreeMap<>(
                CalculateAdventuringDayUseCase::compareBreakpointLevels);

        for (int i = 0; i < currentLevels.length; i++) {
            while (currentLevels[i] < 20) {
                int nextLevel = currentLevels[i] + 1;
                int breakpoint = (PartyCharacterProgress.minimumXpForLevel(nextLevel)
                        - PartyCharacterProgress.minimumXpForLevel(startLevels[i])) * partySize;
                if (breakpoint <= dayStartXp) {
                    currentLevels[i] = nextLevel;
                    continue;
                }
                if (breakpoint > dayEndXp) {
                    break;
                }
                BreakpointLevel level = new BreakpointLevel(breakpoint, nextLevel);
                Integer currentCount = groupedEvents.get(level);
                groupedEvents.put(level, currentCount == null ? 1 : currentCount + 1);
                currentLevels[i] = nextLevel;
            }
        }

        for (Map.Entry<BreakpointLevel, Integer> entry : groupedEvents.entrySet()) {
            events.add(PartyAdventuringDayProgressEvent.levelUp(
                    entry.getKey().groupXp(),
                    dayNumber,
                    entry.getKey().newLevel(),
                    entry.getValue(),
                    partialDay));
        }
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

    private static int[] toLevelArray(List<Integer> levels) {
        int[] result = new int[levels.size()];
        for (int index = 0; index < levels.size(); index++) {
            result[index] = levels.get(index);
        }
        return result;
    }

    private static int compareBreakpointLevels(BreakpointLevel first, BreakpointLevel second) {
        int xpComparison = Integer.compare(first.groupXp(), second.groupXp());
        if (xpComparison != 0) {
            return xpComparison;
        }
        return Integer.compare(first.newLevel(), second.newLevel());
    }

    private record LevelSpan(int startLevel, int endLevel) {
    }

    private record BreakpointLevel(int groupXp, int newLevel) {
    }

}
