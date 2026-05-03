package src.view.dropdowns.adventuringday;

import java.util.List;
import java.util.Objects;

public record AdventuringDayTopBarPublishedEvent(
        Kind kind,
        List<Integer> levels,
        int totalGroupXp
) {

    public AdventuringDayTopBarPublishedEvent {
        Objects.requireNonNull(kind, "kind");
        levels = levels == null ? List.of() : List.copyOf(levels);
        totalGroupXp = Math.max(0, totalGroupXp);
    }

    static AdventuringDayTopBarPublishedEvent calculate(List<Integer> levels, int totalGroupXp) {
        return new AdventuringDayTopBarPublishedEvent(Kind.CALCULATE, levels, totalGroupXp);
    }

    enum Kind {
        CALCULATE
    }
}
