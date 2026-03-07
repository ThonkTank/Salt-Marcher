package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import features.creaturecatalog.ui.StatBlockPane;

/**
 * Details panel for the encounter table editor.
 * Default mode: shows the selected table name.
 * Stat block mode: shows a creature stat block with an X to return to table info.
 */
public class TableDetailsPane extends VBox {

    private final Label nameLabel;
    private final Label emptyLabel;
    private final VBox statBlockSection;
    private final VBox statBlockContent;
    private final ScrollPane statBlockScroll;

    private EncounterTable currentTable = null;
    private Task<?> pendingTask = null;

    public TableDetailsPane() {
        setPadding(new Insets(16));
        setSpacing(8);

        emptyLabel = new Label("Keine Tabelle ausgewählt");
        emptyLabel.getStyleClass().add("text-muted");

        nameLabel = new Label();
        nameLabel.getStyleClass().add("large");
        nameLabel.setWrapText(true);

        // ---- Stat block section (header + scrollable content) ----
        Label titleLabel = new Label("Stat Block");
        titleLabel.getStyleClass().add("bold");
        Button closeBtn = new Button("\u00d7");
        closeBtn.getStyleClass().addAll("compact", "remove-btn");
        closeBtn.setAccessibleText("Stat Block schliessen");
        closeBtn.setOnAction(e -> backToTable());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(8, titleLabel, spacer, closeBtn);
        header.setAlignment(Pos.CENTER_LEFT);
        header.setPadding(new Insets(4, 8, 4, 8));
        header.getStyleClass().add("stat-block-fixed-header");

        statBlockContent = new VBox();
        statBlockScroll = new ScrollPane(statBlockContent);
        statBlockScroll.setFitToWidth(true);
        statBlockScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(statBlockScroll, Priority.ALWAYS);

        statBlockSection = new VBox(header, statBlockScroll);
        statBlockSection.getStyleClass().add("stat-block-fixed-panel");
        VBox.setVgrow(statBlockSection, Priority.ALWAYS);

        getChildren().add(emptyLabel);
    }

    /** Switch to table-name mode (also cancels any pending stat block load). */
    public void showTable(EncounterTable table) {
        cancelPending();
        currentTable = table;
        setPadding(new Insets(16));
        setSpacing(8);
        showTableContent();
    }

    /** Show a creature stat block. X button returns to table-name mode. */
    public void showStatBlock(Long creatureId) {
        if (creatureId == null) return;
        cancelPending();
        statBlockContent.getChildren().clear();
        statBlockScroll.setVvalue(0);
        setPadding(Insets.EMPTY);
        setSpacing(0);
        getChildren().setAll(statBlockSection);
        pendingTask = StatBlockPane.loadAsync(creatureId, statBlockContent);
    }

    // ---- Private ----

    private void backToTable() {
        cancelPending();
        setPadding(new Insets(16));
        setSpacing(8);
        showTableContent();
    }

    private void showTableContent() {
        if (currentTable == null) {
            getChildren().setAll(emptyLabel);
        } else {
            nameLabel.setText(currentTable.name);
            getChildren().setAll(nameLabel);
        }
    }

    private void cancelPending() {
        if (pendingTask != null) {
            pendingTask.cancel(false);
            pendingTask = null;
        }
    }
}
