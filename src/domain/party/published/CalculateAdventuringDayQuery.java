package src.domain.party.published;

import java.util.List;

public final class CalculateAdventuringDayQuery {

    private final CalculateAdventuringDayCommand command;

    public CalculateAdventuringDayQuery(
            List<Integer> levels,
            int totalGroupXp
    ) {
        this.command = new CalculateAdventuringDayCommand(
                levels == null ? List.of() : List.copyOf(levels),
                Math.max(0, totalGroupXp));
    }

    public CalculateAdventuringDayCommand toCommand() {
        return command;
    }

    public List<Integer> levels() {
        return command.levels();
    }

    public int totalGroupXp() {
        return command.totalGroupXp();
    }
}
