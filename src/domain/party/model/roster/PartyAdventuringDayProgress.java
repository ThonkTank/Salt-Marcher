package src.domain.party.model.roster;

import java.util.ArrayList;
import java.util.List;

public final class PartyAdventuringDayProgress {

    private final PartyAdventuringDayProgressTotals totals;
    private final List<PartyAdventuringDayLevelProgress> levelProgressions;
    private final List<PartyAdventuringDayProgressEvent> events;

    public PartyAdventuringDayProgress(
            PartyAdventuringDayProgressTotals totals,
            List<PartyAdventuringDayLevelProgress> levelProgressions,
            List<PartyAdventuringDayProgressEvent> events
    ) {
        this.totals = totals == null ? new PartyAdventuringDayProgressTotals(0, 0, 0, 0.0) : totals;
        this.levelProgressions = levelProgressions == null ? List.of() : List.copyOf(levelProgressions);
        this.events = sortedEvents(events);
    }

    public static PartyAdventuringDayProgress empty(int totalGroupXp) {
        return new PartyAdventuringDayProgress(
                new PartyAdventuringDayProgressTotals(totalGroupXp, 0, 0, 0.0),
                List.of(),
                List.of());
    }

    public PartyAdventuringDayProgressTotals totals() {
        return totals;
    }

    public List<PartyAdventuringDayLevelProgress> levelProgressions() {
        return List.copyOf(levelProgressions);
    }

    public List<PartyAdventuringDayProgressEvent> events() {
        return List.copyOf(events);
    }

    public int shortRests() {
        int count = 0;
        for (PartyAdventuringDayProgressEvent event : events) {
            if (event.isShortRest()) {
                count++;
            }
        }
        return count;
    }

    public int longRests() {
        int count = 0;
        for (PartyAdventuringDayProgressEvent event : events) {
            if (event.isLongRest()) {
                count++;
            }
        }
        return count;
    }

    private static List<PartyAdventuringDayProgressEvent> sortedEvents(
            List<PartyAdventuringDayProgressEvent> values
    ) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        List<PartyAdventuringDayProgressEvent> result = new ArrayList<>(values);
        result.sort(PartyAdventuringDayProgress::compareEvents);
        return List.copyOf(result);
    }

    private static int compareEvents(
            PartyAdventuringDayProgressEvent first,
            PartyAdventuringDayProgressEvent second
    ) {
        int xpComparison = Integer.compare(first.groupXp(), second.groupXp());
        if (xpComparison != 0) {
            return xpComparison;
        }
        int kindComparison = Integer.compare(first.sortOrder(), second.sortOrder());
        if (kindComparison != 0) {
            return kindComparison;
        }
        return Integer.compare(first.newLevel(), second.newLevel());
    }
}
