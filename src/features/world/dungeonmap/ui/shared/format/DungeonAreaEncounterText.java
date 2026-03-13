package features.world.dungeonmap.ui.shared.format;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonAreaEncounterTableLink;

import java.util.List;
import java.util.Locale;

public final class DungeonAreaEncounterText {

    private DungeonAreaEncounterText() {
        throw new AssertionError("No instances");
    }

    public static String formatCadence(int encounterEveryHours) {
        int effectiveHours = Math.max(1, encounterEveryHours);
        return "1 Encounter alle " + effectiveHours + " Stunden";
    }

    public static String formatAreaSummary(DungeonArea area) {
        if (area == null) {
            return "-";
        }
        String cadence = formatCadence(area.encounterEveryHours());
        if (area.encounterTableLinks().isEmpty()) {
            return cadence + ", keine Tabellen";
        }
        return cadence + ", " + area.encounterTableLinks().size() + " Tabellen";
    }

    public static String formatPercent(int weight, int totalWeight) {
        if (totalWeight <= 0) {
            return "0%";
        }
        double percent = (double) weight * 100.0 / totalWeight;
        long rounded = Math.round(percent);
        if (Math.abs(percent - rounded) < 0.05d) {
            return rounded + "%";
        }
        return String.format(Locale.US, "%.1f%%", percent);
    }

    public static int totalWeight(List<DungeonAreaEncounterTableLink> links) {
        if (links == null || links.isEmpty()) {
            return 0;
        }
        int total = 0;
        for (DungeonAreaEncounterTableLink link : links) {
            total += Math.max(1, link.weight());
        }
        return total;
    }
}
