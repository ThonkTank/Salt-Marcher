package src.domain.party.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import src.domain.party.model.roster.helper.PartyAdventuringDayBudgetHelper;
import src.domain.party.model.roster.helper.PartyLevelProgressionHelper;
import src.domain.party.published.AdventuringDayLevelProgress;

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
            totalXp += PartyAdventuringDayBudgetHelper.perCharacter(level);
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
        List<AdventuringDayLevelProgress> levelProgressions = buildLevelProgressions(levels, perCharacterAwardedXp);
        List<ProgressEvent> events = new ArrayList<>();

        int[] startLevels = toLevelArray(levels);
        int[] currentLevels = toLevelArray(levels);
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

        events.sort(new ProgressEventComparator());

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

    private static List<AdventuringDayLevelProgress> buildLevelProgressions(List<Integer> levels, int perCharacterAwardedXp) {
        Map<LevelSpan, Integer> counts = new LinkedHashMap<>();
        for (Integer level : levels) {
            int endLevel = levelAfterAwardedXp(level, perCharacterAwardedXp);
            LevelSpan span = new LevelSpan(level, endLevel);
            Integer currentCount = counts.get(span);
            counts.put(span, currentCount == null ? 1 : currentCount + 1);
        }
        List<AdventuringDayLevelProgress> result = new ArrayList<>();
        for (Map.Entry<LevelSpan, Integer> entry : counts.entrySet()) {
            LevelSpan span = entry.getKey();
            result.add(new AdventuringDayLevelProgress(
                    span.startLevel(),
                    span.endLevel(),
                    entry.getValue(),
                    Math.max(0, span.endLevel() - span.startLevel())));
        }
        return List.copyOf(result);
    }

    private static int levelAfterAwardedXp(int startLevel, int perCharacterAwardedXp) {
        int totalXp = PartyLevelProgressionHelper.minimumXpForLevel(startLevel);
        int level = startLevel;
        while (level < 20
                && totalXp + perCharacterAwardedXp >= PartyLevelProgressionHelper.minimumXpForLevel(level + 1)) {
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
        Map<BreakpointLevel, Integer> groupedEvents = new TreeMap<>(new BreakpointLevelComparator());

        for (int i = 0; i < currentLevels.length; i++) {
            while (currentLevels[i] < 20) {
                int nextLevel = currentLevels[i] + 1;
                int breakpoint = (PartyLevelProgressionHelper.minimumXpForLevel(nextLevel)
                        - PartyLevelProgressionHelper.minimumXpForLevel(startLevels[i])) * partySize;
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
                normalized.add(PartyLevelProgressionHelper.clampLevel(level));
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

    private static final class ProgressEventComparator implements Comparator<ProgressEvent> {
        @Override
        public int compare(ProgressEvent first, ProgressEvent second) {
            int xpComparison = Integer.compare(first.groupXp(), second.groupXp());
            if (xpComparison != 0) {
                return xpComparison;
            }
            int typeComparison = Integer.compare(first.type().sortOrder(), second.type().sortOrder());
            if (typeComparison != 0) {
                return typeComparison;
            }
            return Integer.compare(first.newLevel(), second.newLevel());
        }
    }

    private static final class BreakpointLevelComparator implements Comparator<BreakpointLevel> {
        @Override
        public int compare(BreakpointLevel first, BreakpointLevel second) {
            int xpComparison = Integer.compare(first.groupXp(), second.groupXp());
            if (xpComparison != 0) {
                return xpComparison;
            }
            return Integer.compare(first.newLevel(), second.newLevel());
        }
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
            List<AdventuringDayLevelProgress> levelProgressions,
            List<ProgressEvent> events) {
        public Progress {
            levelProgressions = immutableEvents(levelProgressions);
            events = immutableEvents(events);
        }

        @Override
        public List<AdventuringDayLevelProgress> levelProgressions() {
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

    public record ProgressEvent(
            int groupXp,
            ProgressEventType type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay) {
    }

    public static final class ProgressEventType {

        public static final ProgressEventType LEVEL_UP = new ProgressEventType("LEVEL_UP", 0);
        public static final ProgressEventType SHORT_REST = new ProgressEventType("SHORT_REST", 1);
        public static final ProgressEventType LONG_REST = new ProgressEventType("LONG_REST", 2);

        private final String name;
        private final int sortOrder;

        private ProgressEventType(String name, int sortOrder) {
            this.name = name;
            this.sortOrder = sortOrder;
        }

        public String name() {
            return name;
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
