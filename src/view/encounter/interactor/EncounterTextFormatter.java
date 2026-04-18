package src.view.encounter.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterCreature;
import src.view.encounter.Model.EncounterModel;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

final class EncounterTextFormatter {

    private EncounterTextFormatter() {
    }

    static BudgetText budgetText(@Nullable EncounterBudgetSummary budget) {
        if (budget == null || budget.partyLevels().isEmpty()) {
            return new BudgetText("No active party.", "", "");
        }
        return new BudgetText(
                "Active party levels: "
                        + budget.partyLevels().stream().map(String::valueOf).collect(Collectors.joining(", "))
                        + "  |  Avg " + budget.averageLevel(),
                "Thresholds  E " + budget.easyXp() + "  M " + budget.mediumXp()
                        + "  H " + budget.hardXp() + "  D " + budget.deadlyXp(),
                "Daily budget " + budget.consumedDailyXp() + "/" + budget.dailyBudgetXp()
                        + " XP  |  Remaining " + budget.remainingDailyXp()
        );
    }

    static String lockSummary(List<src.domain.encounter.api.EncounterLock> lockedCreatures) {
        if (lockedCreatures.isEmpty()) {
            return "Locked: none";
        }
        String summary = lockedCreatures.stream()
                .map(lock -> lock.quantity() + "x #" + lock.creatureId())
                .collect(Collectors.joining(", "));
        return "Locked: " + summary;
    }

    static String excludeSummary(Set<Long> excludedCreatureIds) {
        if (excludedCreatureIds.isEmpty()) {
            return "Excluded: none";
        }
        return "Excluded creature ids: "
                + excludedCreatureIds.stream().map(String::valueOf).collect(Collectors.joining(", "));
    }

    static String creatureSummary(List<EncounterCreature> creatures) {
        return creatures.stream()
                .map(creature -> creature.quantity() + "x " + creature.name())
                .collect(Collectors.joining(" + "));
    }

    static String detailText(EncounterModel.@Nullable EncounterAlternativeViewData selected) {
        if (selected == null) {
            return "Generate an encounter to inspect the composition.";
        }
        StringBuilder text = new StringBuilder();
        text.append(selected.title()).append('\n');
        text.append(selected.difficultyLabel()).append("  |  ")
                .append(selected.adjustedXp()).append(" adjusted XP  |  ")
                .append(selected.creatureCount()).append(" creatures").append('\n');
        if (!selected.highlights().isEmpty()) {
            appendHighlights(text, selected.highlights());
        }
        appendComposition(text, selected.creatures());
        return text.toString();
    }

    private static void appendHighlights(StringBuilder text, List<String> highlights) {
        text.append('\n').append("Highlights").append('\n');
        for (String highlight : highlights) {
            text.append("- ").append(highlight).append('\n');
        }
    }

    private static void appendComposition(
            StringBuilder text,
            List<EncounterModel.EncounterCreatureViewData> creatures
    ) {
        text.append('\n').append("Composition").append('\n');
        for (EncounterModel.EncounterCreatureViewData creature : creatures) {
            text.append("- ")
                    .append(creature.quantity()).append("x ")
                    .append(creature.name())
                    .append(" (CR ").append(creature.challengeRating())
                    .append(", ").append(creature.xp()).append(" XP, ")
                    .append(creature.role()).append(')');
            if (!creature.tags().isEmpty()) {
                text.append(" [").append(String.join(", ", creature.tags())).append(']');
            }
            text.append('\n');
        }
    }

    record BudgetText(
            String partySummary,
            String thresholdsSummary,
            String dailyBudgetSummary
    ) {
    }
}
