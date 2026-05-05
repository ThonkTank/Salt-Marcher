package src.domain.party.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import src.domain.party.roster.policy.PartyAdventuringDayBudgetPolicy;
import src.domain.party.roster.policy.PartyLevelProgressionPolicy;

public final class CalculateAdventuringDayUseCase {

    public Result execute(List<Integer> levels, int totalGroupXp) {
        List<Integer> normalizedLevels = normalizeLevels(levels);
        return new Result(
                computeBudget(normalizedLevels),
                computeProgress(normalizedLevels, Math.max(0, totalGroupXp)));
    }

    private static Budget computeBudget(List<Integer> levels) {
        if (levels.isEmpty()) {
            return new Budget(0, 0, 0, 0, 0);
        }
        int totalXp = 0;
        for (Integer level : levels) {
            totalXp += PartyAdventuringDayBudgetPolicy.perCharacter(level);
        }
        int perThirdXp = (int) Math.round(totalXp / 3.0);
        return new Budget(
                totalXp,
                perThirdXp,
                perThirdXp,
                (int) Math.round(totalXp * 2.0 / 3.0),
                levels.size());
    }

    private static Progress computeProgress(List<Integer> levels, int totalGroupXp) {
        if (levels.isEmpty()) {
            return Progress.empty(totalGroupXp);
        }

        int partySize = levels.size();
        int perCharacterAwardedXp = totalGroupXp / partySize;
        List<LevelProgress> levelProgressions = buildLevelProgressions(levels, perCharacterAwardedXp);
        List<ProgressEvent> events = new ArrayList<>();

        int[] startLevels = levels.stream().mapToInt(Integer::intValue).toArray();
        int[] currentLevels = levels.stream().mapToInt(Integer::intValue).toArray();
        int consumedGroupXp = 0;
        int remainingGroupXp = totalGroupXp;
        int dayNumber = 1;
        int fullDays = 0;
        int shortRests = 0;
        int longRests = 0;
        double totalDays = 0.0;

        while (remainingGroupXp > 0) {
            List<Integer> dayLevels = new ArrayList<>(partySize);
            for (int level : currentLevels) {
                dayLevels.add(level);
            }
            Budget dayBudget = computeBudget(dayLevels);
            int dayTotalXp = Math.max(1, dayBudget.totalXp());
            int dayConsumedXp = Math.min(remainingGroupXp, dayTotalXp);
            int dayStartXp = consumedGroupXp;
            int dayEndXp = dayStartXp + dayConsumedXp;
            boolean partialDay = dayConsumedXp < dayTotalXp;

            if (dayConsumedXp >= dayBudget.firstShortRestXp()) {
                events.add(new ProgressEvent(
                        dayStartXp + dayBudget.firstShortRestXp(),
                        ProgressEventType.SHORT_REST,
                        dayNumber,
                        0,
                        0,
                        partialDay));
                shortRests++;
            }
            if (dayConsumedXp >= dayBudget.secondShortRestXp()) {
                events.add(new ProgressEvent(
                        dayStartXp + dayBudget.secondShortRestXp(),
                        ProgressEventType.SHORT_REST,
                        dayNumber,
                        0,
                        0,
                        partialDay));
                shortRests++;
            }

            appendLevelUpEvents(events, startLevels, currentLevels, partySize, dayNumber, dayStartXp, dayEndXp, partialDay);

            if (!partialDay) {
                events.add(new ProgressEvent(dayEndXp, ProgressEventType.LONG_REST, dayNumber, 0, 0, false));
                longRests++;
                fullDays++;
            }

            totalDays += dayConsumedXp / (double) dayTotalXp;
            consumedGroupXp = dayEndXp;
            remainingGroupXp -= dayConsumedXp;
            dayNumber++;
        }

        events.sort(Comparator
                .comparingInt(ProgressEvent::groupXp)
                .thenComparing(event -> event.type().sortOrder())
                .thenComparingInt(ProgressEvent::newLevel));

        return new Progress(
                totalGroupXp,
                perCharacterAwardedXp,
                partySize,
                fullDays,
                totalDays,
                shortRests,
                longRests,
                levelProgressions,
                List.copyOf(events));
    }

    private static List<LevelProgress> buildLevelProgressions(List<Integer> levels, int perCharacterAwardedXp) {
        Map<LevelSpan, Integer> counts = new LinkedHashMap<>();
        for (Integer level : levels) {
            int endLevel = levelAfterAwardedXp(level, perCharacterAwardedXp);
            counts.merge(new LevelSpan(level, endLevel), 1, Integer::sum);
        }
        List<LevelProgress> result = new ArrayList<>();
        for (Map.Entry<LevelSpan, Integer> entry : counts.entrySet()) {
            LevelSpan span = entry.getKey();
            result.add(new LevelProgress(
                    span.startLevel(),
                    span.endLevel(),
                    entry.getValue(),
                    Math.max(0, span.endLevel() - span.startLevel())));
        }
        return List.copyOf(result);
    }

    private static int levelAfterAwardedXp(int startLevel, int perCharacterAwardedXp) {
        int totalXp = PartyLevelProgressionPolicy.minimumXpForLevel(startLevel);
        int level = startLevel;
        while (level < 20
                && totalXp + perCharacterAwardedXp >= PartyLevelProgressionPolicy.minimumXpForLevel(level + 1)) {
            level++;
        }
        return level;
    }

    private static void appendLevelUpEvents(
            List<ProgressEvent> events,
            int[] startLevels,
            int[] currentLevels,
            int partySize,
            int dayNumber,
            int dayStartXp,
            int dayEndXp,
            boolean partialDay) {
        Map<BreakpointLevel, Integer> groupedEvents = new TreeMap<>(
                Comparator.comparingInt(BreakpointLevel::groupXp).thenComparingInt(BreakpointLevel::newLevel));

        for (int i = 0; i < currentLevels.length; i++) {
            while (currentLevels[i] < 20) {
                int nextLevel = currentLevels[i] + 1;
                int breakpoint = (PartyLevelProgressionPolicy.minimumXpForLevel(nextLevel)
                        - PartyLevelProgressionPolicy.minimumXpForLevel(startLevels[i])) * partySize;
                if (breakpoint <= dayStartXp) {
                    currentLevels[i] = nextLevel;
                    continue;
                }
                if (breakpoint > dayEndXp) {
                    break;
                }
                groupedEvents.merge(new BreakpointLevel(breakpoint, nextLevel), 1, Integer::sum);
                currentLevels[i] = nextLevel;
            }
        }

        for (Map.Entry<BreakpointLevel, Integer> entry : groupedEvents.entrySet()) {
            events.add(new ProgressEvent(
                    entry.getKey().groupXp(),
                    ProgressEventType.LEVEL_UP,
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
                normalized.add(PartyLevelProgressionPolicy.clampLevel(level));
            }
        }
        return List.copyOf(normalized);
    }

    public record Result(Budget budget, Progress progress) {
    }

    public record Budget(
            int totalXp,
            int perThirdXp,
            int firstShortRestXp,
            int secondShortRestXp,
            int characterCount) {
    }

    public record Progress(
            int totalGroupXp,
            int perCharacterAwardedXp,
            int partySize,
            int fullDays,
            double totalDays,
            int shortRests,
            int longRests,
            List<LevelProgress> levelProgressions,
            List<ProgressEvent> events) {
        public Progress {
            levelProgressions = immutableEvents(levelProgressions);
            events = immutableEvents(events);
        }

        @Override
        public List<LevelProgress> levelProgressions() {
            return immutableEvents(levelProgressions);
        }

        @Override
        public List<ProgressEvent> events() {
            return immutableEvents(events);
        }

        private static Progress empty(int totalGroupXp) {
            return new Progress(totalGroupXp, 0, 0, 0, 0.0, 0, 0, List.of(), List.of());
        }
    }

    public record LevelProgress(
            int startLevel,
            int endLevel,
            int characterCount,
            int levelUps) {
    }

    public record ProgressEvent(
            int groupXp,
            ProgressEventType type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay) {
    }

    public enum ProgressEventType {
        LEVEL_UP(0),
        SHORT_REST(1),
        LONG_REST(2);

        private final int sortOrder;

        ProgressEventType(int sortOrder) {
            this.sortOrder = sortOrder;
        }

        int sortOrder() {
            return sortOrder;
        }
    }

    private record LevelSpan(int startLevel, int endLevel) {
    }

    private record BreakpointLevel(int groupXp, int newLevel) {
    }

    private static <T> List<T> immutableEvents(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
