package src.view.dropdowns.adventuringday;

import java.util.List;

public record AdventuringDayTopBarViewInputEvent(
        boolean popupOpening,
        List<Integer> levels,
        int totalGroupXp
) {

    public AdventuringDayTopBarViewInputEvent {
        levels = levels == null ? List.of() : List.copyOf(levels);
    }
}
