package src.domain.party.published;

import java.util.List;

public record CalculateAdventuringDayCommand(
        List<Integer> levels,
        int totalGroupXp
) {

    public CalculateAdventuringDayCommand {
        levels = levels == null ? List.of() : List.copyOf(levels);
    }
}
