package src.view.leftbartabs.worldplanner;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcSummary;

final class WorldPlannerDetailContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection;

    WorldPlannerDetailContentModel(Projection projection) {
        this.projection = new ReadOnlyObjectWrapper<>(projection == null ? Projection.empty() : projection);
    }

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    record Projection(
            String title,
            List<Line> lines
    ) {

        Projection {
            title = title == null ? "Details" : title;
            lines = lines == null ? List.of() : List.copyOf(lines);
        }

        static Projection empty() {
            return new Projection("Details", List.of(new Line("", "Keine Details ausgewählt")));
        }

        static Projection npc(WorldNpcSummary npc) {
            if (npc == null) {
                return empty();
            }
            return new Projection(npc.displayName(), List.of(
                    new Line("Status", npc.status().toString()),
                    new Line("Statblock", "#" + npc.creatureStatblockId()),
                    new Line("Aussehen", npc.appearanceNotes()),
                    new Line("Verhalten", npc.behaviorNotes()),
                    new Line("History", npc.historyNotes()),
                    new Line("Notizen", npc.generalNotes())));
        }

        static Projection faction(WorldFactionSummary faction) {
            if (faction == null) {
                return empty();
            }
            return new Projection(faction.displayName(), List.of(
                    new Line("Primäre Tabelle", "#" + faction.primaryEncounterTableId()),
                    new Line("NPCs", faction.npcIds().toString()),
                    new Line("Bestand", inventoryLimits(faction.inventoryLimits()))));
        }

        static Projection location(WorldLocationSummary location) {
            if (location == null) {
                return empty();
            }
            return new Projection(location.displayName(), List.of(
                    new Line("Fraktionen", location.factionIds().toString()),
                    new Line("Encounter Tabellen", location.encounterTableIds().toString())));
        }

        static Projection sources(String summary, List<String> rows) {
            List<Line> lines = new java.util.ArrayList<>();
            lines.add(new Line("Summary", summary));
            for (String row : rows == null ? List.<String>of() : rows) {
                lines.add(new Line("Source", row));
            }
            return new Projection("Encounter Sources", lines);
        }

        private static String inventoryLimits(List<WorldFactionInventoryLimitSummary> limits) {
            if (limits.isEmpty()) {
                return "unbegrenzt";
            }
            return limits.stream()
                    .map(limit -> limit.finite()
                            ? "#" + limit.creatureStatblockId() + " x" + limit.quantity()
                            : "#" + limit.creatureStatblockId() + " unbegrenzt")
                    .toList()
                    .toString();
        }
    }

    record Line(String label, String value) {
        Line {
            label = label == null ? "" : label;
            value = value == null ? "" : value;
        }
    }
}
