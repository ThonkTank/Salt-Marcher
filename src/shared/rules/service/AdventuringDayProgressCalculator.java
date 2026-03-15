package shared.rules.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class AdventuringDayProgressCalculator {

    private static final int MAX_LEVEL = 20;

    private AdventuringDayProgressCalculator() {
        throw new AssertionError("No instances");
    }

    public static AdventuringDayProgressReport compute(List<Integer> startLevels, int totalGroupXp) {
        if (startLevels == null || startLevels.isEmpty()) {
            return AdventuringDayProgressReport.empty(Math.max(0, totalGroupXp));
        }

        List<Integer> normalizedLevels = startLevels.stream()
                .filter(level -> level != null)
                .map(level -> Math.max(1, Math.min(MAX_LEVEL, level)))
                .toList();
        if (normalizedLevels.isEmpty()) {
            return AdventuringDayProgressReport.empty(Math.max(0, totalGroupXp));
        }

        int safeTotalGroupXp = Math.max(0, totalGroupXp);
        int partySize = normalizedLevels.size();
        // XP awards are tracked per character as whole XP; remainder stays at the group level.
        int perCharacterAwardedXp = safeTotalGroupXp / partySize;

        List<CharacterLevelProgress> levelProgressions = buildCharacterLevelProgressions(
                normalizedLevels,
                perCharacterAwardedXp);
        List<ProgressEvent> events = new ArrayList<>();

        int[] startLevelArray = normalizedLevels.stream().mapToInt(Integer::intValue).toArray();
        int[] currentLevelArray = normalizedLevels.stream().mapToInt(Integer::intValue).toArray();
        int consumedGroupXp = 0;
        int remainingGroupXp = safeTotalGroupXp;
        int dayNumber = 1;
        int fullDays = 0;
        int shortRests = 0;
        int longRests = 0;
        double totalDays = 0.0;

        while (remainingGroupXp > 0) {
            List<Integer> dayLevels = new ArrayList<>(partySize);
            for (int level : currentLevelArray) {
                dayLevels.add(level);
            }
            XpCalculator.AdventuringDayBudget dayBudget = XpCalculator.computeAdventuringDayBudget(dayLevels);
            int dayTotalXp = Math.max(1, dayBudget.totalXp());
            int dayConsumedXp = Math.min(remainingGroupXp, dayTotalXp);
            int dayStartXp = consumedGroupXp;
            int dayEndXp = dayStartXp + dayConsumedXp;
            boolean partialDay = dayConsumedXp < dayTotalXp;

            if (dayConsumedXp >= dayBudget.shortRestAfterFirstThirdXp()) {
                events.add(new ProgressEvent(
                        dayStartXp + dayBudget.shortRestAfterFirstThirdXp(),
                        ProgressEventType.SHORT_REST,
                        dayNumber,
                        0,
                        0,
                        partialDay));
                shortRests++;
            }
            if (dayConsumedXp >= dayBudget.shortRestAfterSecondThirdXp()) {
                events.add(new ProgressEvent(
                        dayStartXp + dayBudget.shortRestAfterSecondThirdXp(),
                        ProgressEventType.SHORT_REST,
                        dayNumber,
                        0,
                        0,
                        partialDay));
                shortRests++;
            }

            appendLevelUpEvents(
                    events,
                    startLevelArray,
                    currentLevelArray,
                    partySize,
                    dayNumber,
                    dayStartXp,
                    dayEndXp,
                    partialDay);

            // Intentional: a partial final chunk is progress within the current day, not a completed long rest.
            if (!partialDay) {
                events.add(new ProgressEvent(
                        dayEndXp,
                        ProgressEventType.LONG_REST,
                        dayNumber,
                        0,
                        0,
                        false));
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

        return new AdventuringDayProgressReport(
                safeTotalGroupXp,
                perCharacterAwardedXp,
                partySize,
                fullDays,
                totalDays,
                shortRests,
                longRests,
                levelProgressions,
                List.copyOf(events));
    }

    public record CharacterLevelProgress(
            int startLevel,
            int endLevel,
            int characterCount,
            int levelUps) {}

    public record ProgressEvent(
            int groupXp,
            ProgressEventType type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay) {}

    public record AdventuringDayProgressReport(
            int totalGroupXp,
            int perCharacterAwardedXp,
            int partySize,
            int fullDays,
            double totalDays,
            int shortRests,
            int longRests,
            List<CharacterLevelProgress> levelProgressions,
            List<ProgressEvent> events) {

        private static AdventuringDayProgressReport empty(int totalGroupXp) {
            return new AdventuringDayProgressReport(
                    totalGroupXp,
                    0,
                    0,
                    0,
                    0.0,
                    0,
                    0,
                    List.of(),
                    List.of());
        }
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

    private record LevelSpan(int startLevel, int endLevel) {}

    private record BreakpointLevel(int groupXp, int newLevel) {}

    private static List<CharacterLevelProgress> buildCharacterLevelProgressions(
            List<Integer> startLevels,
            int perCharacterAwardedXp) {
        Map<LevelSpan, Integer> counts = new LinkedHashMap<>();
        for (Integer startLevel : startLevels) {
            int safeStart = Math.max(1, Math.min(MAX_LEVEL, startLevel == null ? 1 : startLevel));
            int endLevel = levelAfterAwardedXp(safeStart, perCharacterAwardedXp);
            counts.merge(new LevelSpan(safeStart, endLevel), 1, Integer::sum);
        }
        ArrayList<CharacterLevelProgress> result = new ArrayList<>();
        for (Map.Entry<LevelSpan, Integer> entry : counts.entrySet()) {
            LevelSpan span = entry.getKey();
            result.add(new CharacterLevelProgress(
                    span.startLevel(),
                    span.endLevel(),
                    entry.getValue(),
                    Math.max(0, span.endLevel() - span.startLevel())));
        }
        return List.copyOf(result);
    }

    private static int levelAfterAwardedXp(int startLevel, int perCharacterAwardedXp) {
        int totalXp = XpCalculator.xpAtLevel(startLevel);
        int level = startLevel;
        while (level < MAX_LEVEL && (totalXp + perCharacterAwardedXp) >= XpCalculator.xpAtLevel(level + 1)) {
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
                Comparator.comparingInt(BreakpointLevel::groupXp)
                        .thenComparingInt(BreakpointLevel::newLevel));

        for (int i = 0; i < currentLevels.length; i++) {
            while (currentLevels[i] < MAX_LEVEL) {
                int nextLevel = currentLevels[i] + 1;
                int breakpoint = (XpCalculator.xpAtLevel(nextLevel) - XpCalculator.xpAtLevel(startLevels[i])) * partySize;
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
}
