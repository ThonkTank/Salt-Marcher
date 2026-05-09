package src.domain.party.published;

import java.util.List;

public record CalculateAdventuringDayQuery(
        List<Integer> levels,
        int totalGroupXp
) {

    public CalculateAdventuringDayQuery {
        levels = levels == null ? List.of() : List.copyOf(levels);
        totalGroupXp = Math.max(0, totalGroupXp);
    }
}
