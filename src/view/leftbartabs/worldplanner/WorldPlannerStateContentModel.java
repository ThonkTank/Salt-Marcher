package src.view.leftbartabs.worldplanner;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class WorldPlannerStateContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyProjection(Projection nextProjection) {
        projection.set(nextProjection == null ? Projection.empty() : nextProjection);
    }

    record Projection(
            int activeModuleIndex,
            String moduleTitle,
            String statusText,
            String nextActionText,
            NpcEditor npc,
            FactionEditor faction,
            LocationEditor location,
            String sourcesSummary
    ) {

        private static final int NPCS = 0;
        private static final int FACTIONS = 1;
        private static final int LOCATIONS = 2;
        private static final int SOURCES = 3;

        Projection {
            activeModuleIndex = Math.max(NPCS, Math.min(SOURCES, activeModuleIndex));
            moduleTitle = text(moduleTitle);
            statusText = text(statusText);
            nextActionText = text(nextActionText);
            npc = npc == null ? NpcEditor.empty() : npc;
            faction = faction == null ? FactionEditor.empty() : faction;
            location = location == null ? LocationEditor.empty() : location;
            sourcesSummary = text(sourcesSummary);
        }

        static Projection empty() {
            return new Projection(
                    NPCS,
                    "NPCs",
                    "Kein NPC ausgewählt.",
                    "NPC anlegen oder einen NPC wählen.",
                    NpcEditor.empty(),
                    FactionEditor.empty(),
                    LocationEditor.empty(),
                    "");
        }

        static Projection sources(String summary) {
            return new Projection(
                    SOURCES,
                    "Encounter Sources",
                    text(summary),
                    "Read-only Überblick über konfigurierte World-Planner-Quellen.",
                    NpcEditor.empty(),
                    FactionEditor.empty(),
                    LocationEditor.empty(),
                    text(summary));
        }
    }

    record NpcEditor(
            String displayName,
            List<String> statblockLabels,
            String selectedStatblockLabel,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {

        NpcEditor {
            displayName = text(displayName);
            statblockLabels = copied(statblockLabels);
            selectedStatblockLabel = text(selectedStatblockLabel);
            appearanceNotes = text(appearanceNotes);
            behaviorNotes = text(behaviorNotes);
            historyNotes = text(historyNotes);
            generalNotes = text(generalNotes);
        }

        static NpcEditor empty() {
            return new NpcEditor("", List.of(), "", "", "", "", "");
        }

    }

    record FactionEditor(
            String displayName,
            List<String> encounterTableLabels,
            String selectedPrimaryTableLabel,
            List<String> npcReferenceLabels,
            List<String> statblockLabels
    ) {

        FactionEditor {
            displayName = text(displayName);
            encounterTableLabels = copied(encounterTableLabels);
            selectedPrimaryTableLabel = text(selectedPrimaryTableLabel);
            npcReferenceLabels = copied(npcReferenceLabels);
            statblockLabels = copied(statblockLabels);
        }

        static FactionEditor empty() {
            return new FactionEditor("", List.of(), "", List.of(), List.of());
        }

    }

    record LocationEditor(
            String displayName,
            List<String> factionReferenceLabels,
            List<String> encounterTableLabels
    ) {

        LocationEditor {
            displayName = text(displayName);
            factionReferenceLabels = copied(factionReferenceLabels);
            encounterTableLabels = copied(encounterTableLabels);
        }

        static LocationEditor empty() {
            return new LocationEditor("", List.of(), List.of());
        }

    }

    private static List<String> copied(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
