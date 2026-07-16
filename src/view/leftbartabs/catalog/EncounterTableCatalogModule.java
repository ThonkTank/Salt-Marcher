package src.view.leftbartabs.catalog;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.SelectionMode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;

final class EncounterTableCatalogModule {

    private final EncounterApplicationService encounters;
    private final ListView<EncounterTableSummary> tables = new ListView<>();
    private final Label status = new Label();
    private final VBox controls = new VBox(6);
    private final VBox main = new VBox(8);
    private EncounterBuilderInputs currentInputs = EncounterBuilderInputs.empty();

    EncounterTableCatalogModule(
            EncounterTableApplicationService tableApplication,
            EncounterTableCatalogModel catalog,
            EncounterApplicationService encounters,
            EncounterBuilderInputsModel builderInputs
    ) {
        this.encounters = encounters;
        configure();
        catalog.subscribe(this::renderTables);
        builderInputs.subscribe(this::renderSelection);
        renderTables(catalog.current());
        renderSelection(builderInputs.current());
        tableApplication.refreshCatalog(new RefreshEncounterTableCatalogCommand());
    }

    Node controls() {
        return controls;
    }

    Node main() {
        return main;
    }

    private void configure() {
        Label title = new Label("ENCOUNTER-TABELLEN");
        title.getStyleClass().add("catalog-section-title");
        Label guidance = new Label("Mehrfachauswahl begrenzt die nächste Encounter-Generierung auf diese Quellen.");
        guidance.getStyleClass().add("text-muted");
        guidance.setWrapText(true);
        Button apply = new Button("Auswahl als Quelle verwenden");
        apply.setOnAction(event -> publishSelection(selectedIds()));
        Button clear = new Button("Quellen leeren");
        clear.setOnAction(event -> publishSelection(List.of()));
        controls.getChildren().setAll(title, guidance, new HBox(8, apply, clear));

        tables.getSelectionModel().setSelectionMode(SelectionMode.MULTIPLE);
        tables.setCellFactory(ignored -> new EncounterTableCell());
        HBox footer = new HBox(status);
        footer.setAlignment(Pos.CENTER_LEFT);
        main.getChildren().setAll(tables, footer);
        main.setVgrow(tables, Priority.ALWAYS);
    }

    private void renderTables(EncounterTableCatalogResult result) {
        tables.getItems().setAll(result.tables());
        renderSelection(currentInputs);
        status.setText(result.tables().size() + " Tabellen");
    }

    private void renderSelection(EncounterBuilderInputs inputs) {
        currentInputs = inputs == null ? EncounterBuilderInputs.empty() : inputs;
        Set<Long> selected = new HashSet<>(currentInputs.encounterTableIds());
        tables.getSelectionModel().clearSelection();
        for (int index = 0; index < tables.getItems().size(); index++) {
            if (selected.contains(tables.getItems().get(index).tableId())) {
                tables.getSelectionModel().select(index);
            }
        }
    }

    private List<Long> selectedIds() {
        return tables.getSelectionModel().getSelectedItems().stream()
                .map(EncounterTableSummary::tableId)
                .toList();
    }

    private void publishSelection(List<Long> tableIds) {
        EncounterBuilderInputs before = currentInputs;
        encounters.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(new EncounterBuilderInputs(
                before.creatureTypes(), before.creatureSubtypes(), before.biomes(),
                before.autoDifficulty(), before.difficultyLevel(),
                before.autoBalance(), before.balanceLevel(),
                before.autoAmount(), before.amountValue(),
                before.autoDiversity(), before.diversityLevel(),
                tableIds, before.worldFactionIds(), before.worldLocationId())));
    }

    private static final class EncounterTableCell extends ListCell<EncounterTableSummary> {
        @Override
        protected void updateItem(EncounterTableSummary table, boolean empty) {
            super.updateItem(table, empty);
            if (empty || table == null) {
                setText(null);
                return;
            }
            String loot = table.linkedLootTableId() == null ? "keine Loot-Verknüpfung"
                    : "Loot #" + table.linkedLootTableId();
            setText(table.name() + "  ·  " + loot);
        }
    }
}
