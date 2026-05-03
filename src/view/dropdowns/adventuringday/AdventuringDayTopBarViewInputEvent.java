package src.view.dropdowns.adventuringday;

import java.util.List;

public record AdventuringDayTopBarViewInputEvent(
        Source source,
        List<Integer> levels,
        int totalGroupXp
) {

    public AdventuringDayTopBarViewInputEvent {
        source = source == null ? Source.POPUP_OPENED : source;
        levels = levels == null ? List.of() : List.copyOf(levels);
    }

    enum Source {
        POPUP_OPENED,
        CALCULATOR_SUBMIT
    }
}
