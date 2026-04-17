package src.view.encounter.View;

import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextArea;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import src.view.encounter.Controller.EncounterController;
import src.view.encounter.Model.EncounterModel;
import src.view.creatures.View.CreatureFilterPane;
import src.view.creatures.View.FilterPaneConfig;

import java.util.Objects;

public final class EncounterView {

    private final EncounterModel model;
    private final EncounterController controller;
    private final VBox controls;
    private final VBox workspace;

    public EncounterView(EncounterModel model, EncounterController controller) {
        this.model = Objects.requireNonNull(model, "model");
        this.controller = Objects.requireNonNull(controller, "controller");
        this.controls = buildControls();
        this.workspace = buildWorkspace();
    }

    public Node controls() {
        return controls;
    }

    public Node workspace() {
        return workspace;
    }

    private VBox buildControls() {
        Label title = new Label("Encounter");
        title.getStyleClass().add("editor-panel-title");

        ComboBox<String> difficulty = new ComboBox<>(model.difficultyOptions());
        difficulty.valueProperty().bindBidirectional(model.selectedDifficultyProperty());
        difficulty.setMaxWidth(Double.MAX_VALUE);
        CreatureFilterPane filterPane = new CreatureFilterPane(
                model.filterOptions(),
                model.filterSelection(),
                FilterPaneConfig.encounterDefaults(),
                null);

        Button generate = new Button("Generate");
        generate.getStyleClass().add("neutral-action");
        generate.setMaxWidth(Double.MAX_VALUE);
        generate.setOnAction(event -> controller.generate());

        Button reroll = new Button("Reroll");
        reroll.getStyleClass().add("neutral-action");
        reroll.setMaxWidth(Double.MAX_VALUE);
        reroll.setOnAction(event -> controller.reroll());

        Label difficultyHeader = new Label("DIFFICULTY");
        difficultyHeader.getStyleClass().addAll("section-header", "text-muted");

        Label filterHeader = new Label("CREATURE FILTERS");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        VBox pane = new VBox(10,
                title,
                difficultyHeader,
                labeledControl("Band", difficulty),
                new Separator(),
                filterHeader,
                filterPane,
                generate,
                reroll);
        pane.getStyleClass().addAll("dungeon-editor-toolbar", "dungeon-editor-sidebar");
        pane.setPadding(new Insets(12));
        return pane;
    }

    private VBox buildWorkspace() {
        Label partySummary = new Label();
        partySummary.textProperty().bind(model.partySummaryProperty());
        partySummary.setWrapText(true);

        Label thresholds = new Label();
        thresholds.textProperty().bind(model.thresholdsSummaryProperty());
        thresholds.setWrapText(true);

        Label dailyBudget = new Label();
        dailyBudget.textProperty().bind(model.dailyBudgetSummaryProperty());
        dailyBudget.setWrapText(true);

        Label resultSummary = new Label();
        resultSummary.textProperty().bind(model.resultSummaryProperty());
        resultSummary.setWrapText(true);

        TableView<EncounterModel.EncounterAlternativeViewData> table = new TableView<>(model.alternatives());
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        TableColumn<EncounterModel.EncounterAlternativeViewData, String> title = new TableColumn<>("Encounter");
        title.setCellValueFactory(cell -> new ReadOnlyObjectWrapper<>(cell.getValue().title()));
        TableColumn<EncounterModel.EncounterAlternativeViewData, String> difficulty = new TableColumn<>("Band");
        difficulty.setCellValueFactory(cell -> new ReadOnlyObjectWrapper<>(cell.getValue().difficultyLabel()));
        TableColumn<EncounterModel.EncounterAlternativeViewData, Integer> adjustedXp = new TableColumn<>("Adjusted XP");
        adjustedXp.setCellValueFactory(cell -> new ReadOnlyObjectWrapper<>(cell.getValue().adjustedXp()));
        TableColumn<EncounterModel.EncounterAlternativeViewData, String> composition = new TableColumn<>("Composition");
        composition.setCellValueFactory(cell -> new ReadOnlyObjectWrapper<>(cell.getValue().creatureSummary()));
        table.getColumns().setAll(title, difficulty, adjustedXp, composition);
        table.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> model.selectedAlternativeProperty().set(after));
        model.selectedAlternativeProperty().addListener((ignored, before, after) -> {
            if (after != null && !Objects.equals(table.getSelectionModel().getSelectedItem(), after)) {
                table.getSelectionModel().select(after);
            }
        });

        TextArea detail = new TextArea();
        detail.textProperty().bind(model.detailTextProperty());
        detail.setEditable(false);
        detail.setWrapText(true);
        detail.setPrefRowCount(12);
        VBox.setVgrow(table, Priority.ALWAYS);
        VBox.setVgrow(detail, Priority.ALWAYS);

        VBox pane = new VBox(10, partySummary, thresholds, dailyBudget, resultSummary, table, detail);
        pane.setPadding(new Insets(12));
        return pane;
    }

    private static Node labeledControl(String label, Node control) {
        Label caption = new Label(label);
        HBox.setHgrow(control, Priority.ALWAYS);
        VBox box = new VBox(4, caption, control);
        return box;
    }
}
