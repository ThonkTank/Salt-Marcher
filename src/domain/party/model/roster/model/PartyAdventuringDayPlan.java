package src.domain.party.model.roster.model;

import java.util.List;

public final class PartyAdventuringDayPlan {

    private final int totalBudgetXp;
    private final int characterCount;

    private PartyAdventuringDayPlan(int totalBudgetXp, int characterCount) {
        this.totalBudgetXp = Math.max(0, totalBudgetXp);
        this.characterCount = Math.max(0, characterCount);
    }

    public static PartyAdventuringDayPlan empty() {
        return new PartyAdventuringDayPlan(0, 0);
    }

    public static PartyAdventuringDayPlan forLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return empty();
        }
        int totalXp = 0;
        for (Integer level : levels) {
            if (level != null) {
                totalXp += PartyAdventuringDayBudget.forLevel(level).perCharacter();
            }
        }
        return new PartyAdventuringDayPlan(totalXp, levels.size());
    }

    public int totalBudgetXp() {
        return totalBudgetXp;
    }

    public int perThirdXp() {
        return (int) Math.round(totalBudgetXp / 3.0);
    }

    public int firstShortRestXp() {
        return perThirdXp();
    }

    public int secondShortRestXp() {
        return (int) Math.round(totalBudgetXp * 2.0 / 3.0);
    }

    public int characterCount() {
        return characterCount;
    }

    public boolean hasCharacters() {
        return characterCount > 0;
    }
}
