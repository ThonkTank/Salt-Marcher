package src.view.encounter.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.api.EncounterLock;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

final class EncounterTextFormatter {

    private EncounterTextFormatter() {
    }

    static String lockSummary(List<EncounterLock> lockedCreatures) {
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

    static String detailText(EncounterSnapshot.@Nullable AlternativeViewData selected) {
        if (selected == null) {
            return "Generate an encounter to inspect the composition.";
        }
        StringBuilder text = new StringBuilder();
        text.append(selected.title()).append('\n');
        text.append(selected.difficultyLabel()).append("  |  ")
                .append(selected.adjustedXp()).append(" adjusted XP  |  ")
                .append(selected.creatureCount()).append(" creatures").append('\n');
        if (!selected.highlights().isEmpty()) {
            text.append('\n').append("Highlights").append('\n');
            for (String highlight : selected.highlights()) {
                text.append("- ").append(highlight).append('\n');
            }
        }
        text.append('\n').append("Composition").append('\n');
        for (EncounterSnapshot.CreatureViewData creature : selected.creatures()) {
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
        return text.toString();
    }
}
