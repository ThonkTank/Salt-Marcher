package features.party.domain.roster.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import features.party.domain.roster.PartyAdventuringDayLevelProgress;
import features.party.domain.roster.PartyAdventuringDayPlan;
import features.party.domain.roster.PartyAdventuringDayProgress;
import features.party.domain.roster.PartyAdventuringDayProgressEvent;
import features.party.domain.roster.PartyAdventuringDayProgressTotals;
import features.party.domain.roster.PartyCharacterProgress;

public final class AdventuringDayProgressCalculationHelper {

    public PartyAdventuringDayProgress compute(List<Integer> levels, int totalGroupXp) {
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
            PartyAdventuringDayPlan dayBudget = PartyAdventuringDayPlan.forLevels(toLevels(currentLevels));
            int dayTotalXp = Math.max(1, dayBudget.totalBudgetXp());
            int dayConsumedXp = Math.min(remainingGroupXp, dayTotalXp);
            int dayStartXp = consumedGroupXp;
            int dayEndXp = dayStartXp + dayConsumedXp;
            boolean partialDay = dayConsumedXp < dayTotalXp;

            appendRestEvents(events, dayBudget, dayConsumedXp, dayStartXp, dayNumber, partialDay);
            appendLevelUpEvents(
                    events,
                    startLevels,
                    currentLevels,
                    partySize,
                    dayStartXp,
                    dayEndXp,
                    dayNumber,
                    partialDay);
            if (!partialDay) {
                events.add(PartyAdventuringDayProgressEvent.longRest(dayEndXp, dayNumber));
            }

            totalDays += dayConsumedXp / (double) dayTotalXp;
            consumedGroupXp = dayEndXp;
            remainingGroupXp -= dayConsumedXp;
            dayNumber++;
        }

        return new PartyAdventuringDayProgress(
                new PartyAdventuringDayProgressTotals(
                        totalGroupXp,
                        perCharacterAwardedXp,
                        partySize,
                        totalDays),
                levelProgressions,
                List.copyOf(events));
    }

    private static void appendRestEvents(
            List<PartyAdventuringDayProgressEvent> events,
            PartyAdventuringDayPlan dayBudget,
            int dayConsumedXp,
            int dayStartXp,
            int dayNumber,
            boolean partialDay
    ) {
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
            int dayStartXp,
            int dayEndXp,
            int dayNumber,
            boolean partialDay
    ) {
        Map<BreakpointLevel, Integer> groupedEvents = new TreeMap<>(
                AdventuringDayProgressCalculationHelper::compareBreakpointLevels);

        for (int i = 0; i < currentLevels.length; i++) {
            appendCharacterLevelUps(
                    groupedEvents,
                    startLevels[i],
                    currentLevels,
                    i,
                    partySize,
                    dayStartXp,
                    dayEndXp);
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

    private static void appendCharacterLevelUps(
            Map<BreakpointLevel, Integer> groupedEvents,
            int startLevel,
            int[] currentLevels,
            int characterIndex,
            int partySize,
            int dayStartXp,
            int dayEndXp
    ) {
        while (currentLevels[characterIndex] < 20) {
            int nextLevel = currentLevels[characterIndex] + 1;
            int breakpoint = (PartyCharacterProgress.minimumXpForLevel(nextLevel)
                    - PartyCharacterProgress.minimumXpForLevel(startLevel)) * partySize;
            if (breakpoint <= dayStartXp) {
                currentLevels[characterIndex] = nextLevel;
                continue;
            }
            if (breakpoint > dayEndXp) {
                break;
            }
            BreakpointLevel level = new BreakpointLevel(breakpoint, nextLevel);
            Integer currentCount = groupedEvents.get(level);
            groupedEvents.put(level, currentCount == null ? 1 : currentCount + 1);
            currentLevels[characterIndex] = nextLevel;
        }
    }

    private static int[] toLevelArray(List<Integer> levels) {
        int[] result = new int[levels.size()];
        for (int index = 0; index < levels.size(); index++) {
            result[index] = levels.get(index);
        }
        return result;
    }

    private static List<Integer> toLevels(int[] currentLevels) {
        List<Integer> levels = new ArrayList<>(currentLevels.length);
        for (int level : currentLevels) {
            levels.add(level);
        }
        return levels;
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
