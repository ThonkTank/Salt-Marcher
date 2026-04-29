package src.view.dropdowns.adventuringday;

import java.util.List;

public record AdventuringDayCalculatorTopBarViewInputEvent(
        List<Integer> levels,
        int totalGroupXp
) {

    public AdventuringDayCalculatorTopBarViewInputEvent {
        levels = levels == null ? List.of() : List.copyOf(levels);
    }
}
