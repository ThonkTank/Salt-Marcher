package src.view.encounter.View;

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
import src.view.encounter.ViewModel.EncounterSnapshot;
import src.view.encounter.ViewModel.EncounterViewModel;

import java.util.Objects;
import java.util.function.Supplier;

public final class EncounterView {

    private final EncounterViewModel viewModel;
    private final VBox controls;
    private final VBox workspace;
    private final Supplier<Node> controlsNode;
    private final Supplier<Node> workspaceNode;
    private final ComboBox<String> difficulty = new ComboBox<>();
    private final EncounterFilterPane filterPane;
    private final Button generateButton = new Button("Generate");
    private final Button rerollButton = new Button("Reroll");
    private final Label partySummary = new Label();
    private final Label thresholds = new Label();
    private final Label dailyBudget = new Label();
    private final Label resultSummary = new Label();
    private final TableView<EncounterSnapshot.AlternativeViewData> table = new TableView<>();
    private final TextArea detail = new TextArea();
    private boolean refreshing;

    public EncounterView(EncounterViewModel viewModel) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.filterPane = new EncounterFilterPane(viewModel);
        this.controls = buildControls();
        this.workspace = buildWorkspace();
        this.controlsNode = () -> controls;
        this.workspaceNode = () -> workspace;
        this.viewModel.addChangeListener(this::refreshFromViewModel);
        refreshFromViewModel();
    }

    public Node controls() {
        return Objects.requireNonNull(controlsNode.get(), "controls");
    }

    public Node workspace() {
        return Objects.requireNonNull(workspaceNode.get(), "workspace");
    }

    private VBox buildControls() {
        Label title = new Label("Encounter");
        title.getStyleClass().add("panel-title");

        difficulty.setMaxWidth(Double.MAX_VALUE);
        difficulty.valueProperty().addListener((ignored, before, after) -> {
            if (!refreshing) {
                viewModel.setSelectedDifficulty(after);
            }
        });

        generateButton.getStyleClass().add("neutral-action");
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setOnAction(event -> viewModel.generate());

        rerollButton.getStyleClass().add("neutral-action");
        rerollButton.setMaxWidth(Double.MAX_VALUE);
        rerollButton.setOnAction(event -> viewModel.reroll());

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
                generateButton,
                rerollButton);
        pane.getStyleClass().addAll("control-toolbar", "control-stack");
        pane.setPadding(new Insets(12));
        return pane;
    }

    private VBox buildWorkspace() {
        partySummary.setWrapText(true);

        thresholds.setWrapText(true);

        dailyBudget.setWrapText(true);

        resultSummary.setWrapText(true);

        configureAlternativesTable();
        configureDetailArea();
        VBox.setVgrow(table, Priority.ALWAYS);
        VBox.setVgrow(detail, Priority.ALWAYS);

        VBox pane = new VBox(10, partySummary, thresholds, dailyBudget, resultSummary, table, detail);
        pane.setPadding(new Insets(12));
        return pane;
    }

    private void configureAlternativesTable() {
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        TableColumn<EncounterSnapshot.AlternativeViewData, String> title = new TableColumn<>("Encounter");
        title.setCellValueFactory(cell -> javafx.beans.binding.Bindings.createStringBinding(cell.getValue()::title));
        TableColumn<EncounterSnapshot.AlternativeViewData, String> difficultyColumn = new TableColumn<>("Band");
        difficultyColumn.setCellValueFactory(cell -> javafx.beans.binding.Bindings.createStringBinding(cell.getValue()::difficultyLabel));
        TableColumn<EncounterSnapshot.AlternativeViewData, Number> adjustedXp = new TableColumn<>("Adjusted XP");
        adjustedXp.setCellValueFactory(cell -> javafx.beans.binding.Bindings.createIntegerBinding(cell.getValue()::adjustedXp));
        TableColumn<EncounterSnapshot.AlternativeViewData, String> composition = new TableColumn<>("Composition");
        composition.setCellValueFactory(cell -> javafx.beans.binding.Bindings.createStringBinding(cell.getValue()::creatureSummary));
        table.getColumns().setAll(title, difficultyColumn, adjustedXp, composition);
        table.getSelectionModel().selectedItemProperty()
                .addListener((ignored, before, after) -> {
                    if (!refreshing) {
                        viewModel.selectAlternative(after);
                    }
                });
    }

    private void configureDetailArea() {
        detail.setEditable(false);
        detail.setWrapText(true);
        detail.setPrefRowCount(12);
    }

    private void refreshFromViewModel() {
        EncounterSnapshot snapshot = viewModel.snapshot();
        withRefreshing(() -> {
            difficulty.getItems().setAll(snapshot.difficultyOptions());
            difficulty.setValue(snapshot.selectedDifficulty());
            table.getItems().setAll(snapshot.alternatives());
            if (snapshot.selectedAlternative() == null) {
                table.getSelectionModel().clearSelection();
            } else if (!Objects.equals(table.getSelectionModel().getSelectedItem(), snapshot.selectedAlternative())) {
                table.getSelectionModel().select(snapshot.selectedAlternative());
            }
        });
        partySummary.setText(snapshot.text().partySummary());
        thresholds.setText(snapshot.text().thresholdsSummary());
        dailyBudget.setText(snapshot.text().dailyBudgetSummary());
        resultSummary.setText(snapshot.text().resultSummary());
        detail.setText(snapshot.text().detailText());
    }

    @SuppressWarnings("PMD.UnusedAssignment")
    private void withRefreshing(Runnable action) {
        refreshing = true;
        try {
            action.run();
        } finally {
            refreshing = false;
        }
    }

    private static Node labeledControl(String label, Node control) {
        Label caption = new Label(label);
        HBox.setHgrow(control, Priority.ALWAYS);
        VBox box = new VBox(4, caption, control);
        return box;
    }
}
