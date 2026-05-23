package src.view.statetabs.encounter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.encounter.published.EncounterStateSnapshot;

final class EncounterInitiativeStateContentModel {

    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.empty());

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    void showInitiative(EncounterStateSnapshot.InitiativePane source) {
        EncounterStateSnapshot.InitiativePane safeSource = source == null
                ? EncounterStateSnapshot.InitiativePane.empty()
                : source;
        panel.set(new PanelModel(safeSource.rows().stream()
                .map(entry -> new EntryView(
                        entry.combatantId(),
                        entry.displayLabel(),
                        entry.kindLabel(),
                        entry.initiativeValue()))
                .toList()));
    }

    record EntryView(String id, String label, String kind, int initiative) {
        EntryView {
            id = id == null ? "" : id;
            label = label == null ? "" : label;
            kind = kind == null ? "" : kind;
        }
    }

    record PanelModel(List<EntryView> entries) {
        PanelModel {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        static PanelModel empty() {
            return new PanelModel(List.of());
        }
    }
}
