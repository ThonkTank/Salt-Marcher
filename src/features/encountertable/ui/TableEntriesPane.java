package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
import features.tables.ui.AbstractWeightedEntriesPane;
import javafx.scene.control.TableColumn;

import java.util.function.Consumer;

/**
 * State panel for the encounter table editor.
 * Shows the entries (creatures) in the currently selected encounter table.
 * Weight (1–10) is adjustable via −/+ buttons; changes are reported via onUpdateWeight.
 */
public class TableEntriesPane extends AbstractWeightedEntriesPane<EncounterTable.Entry> {

    private Consumer<Long> onRequestStatBlock;

    public TableEntriesPane() {
        super("EINTRÄGE", "Keine Einträge");

        TableColumn<EncounterTable.Entry, String> nameCol = createLinkColumn(
                "Name",
                "creature-link",
                "Stat Block: ",
                EncounterTable.Entry::creatureName,
                EncounterTable.Entry::creatureId,
                creatureId -> {
                    if (onRequestStatBlock != null) {
                        onRequestStatBlock.accept(creatureId);
                    }
                });
        nameCol.setMinWidth(100);

        TableColumn<EncounterTable.Entry, String> crCol = textColumn("CR", EncounterTable.Entry::crDisplay);
        crCol.setMinWidth(35);
        crCol.setMaxWidth(50);

        TableColumn<EncounterTable.Entry, Void> weightCol = createWeightColumn(
                EncounterTable.Entry::creatureId,
                EncounterTable.Entry::weight,
                (entry, weight) -> new EncounterTable.Entry(
                        entry.creatureId(), entry.creatureName(), entry.creatureType(),
                        entry.crDisplay(), entry.xp(), weight));
        weightCol.setMinWidth(80);
        weightCol.setMaxWidth(95);

        TableColumn<EncounterTable.Entry, Void> removeCol =
                createRemoveColumn("Aus Tabelle entfernen", EncounterTable.Entry::creatureId);
        removeCol.setMinWidth(45);
        removeCol.setMaxWidth(55);

        table.getColumns().addAll(nameCol, crCol, weightCol, removeCol);
    }

    public void setOnRequestStatBlock(Consumer<Long> callback) {
        this.onRequestStatBlock = callback;
    }
}
