package src.view.dropdowns.adventuringday;

import java.util.List;

public record AdventuringDayTopBarViewInputEvent(
        Kind kind,
        List<Integer> levels,
        int totalGroupXp
) {

    public AdventuringDayTopBarViewInputEvent {
        kind = kind == null ? Kind.OPENED : kind;
        levels = levels == null ? List.of() : List.copyOf(levels);
    }

    static AdventuringDayTopBarViewInputEvent opened() {
        return new AdventuringDayTopBarViewInputEvent(Kind.OPENED, List.of(), 0);
    }

    static AdventuringDayTopBarViewInputEvent calculate(List<Integer> levels, int totalGroupXp) {
        return new AdventuringDayTopBarViewInputEvent(Kind.CALCULATE, levels, totalGroupXp);
    }

    enum Kind {
        OPENED,
        CALCULATE
    }
}
