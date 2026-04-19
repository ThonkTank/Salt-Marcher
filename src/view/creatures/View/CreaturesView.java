package src.view.creatures.View;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.creatures.ViewModel.CreatureFilterOptionsViewData;
import src.view.creatures.ViewModel.CreaturesCatalogSnapshot;
import src.view.creatures.ViewModel.CreaturesCatalogViewData;
import src.view.creatures.ViewModel.CreaturesCatalogViewModel;

import java.util.Objects;

public final class CreaturesView {

    private final CreaturesCatalogViewModel viewModel;
    private final VBox controls = new VBox(10);
    private final VBox workspace = new VBox(10);
    private final TableView<CreaturesCatalogViewData.Row> table = new TableView<>();
    private final Label pageSummaryLabel = new Label();
    private final Label statusLabel = new Label();
    private final Button previousButton = new Button("Previous");
    private final Button nextButton = new Button("Next");

    public CreaturesView(CreaturesCatalogViewModel viewModel) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.viewModel.addChangeListener(this::refreshFromViewModel);
        buildControls();
        buildWorkspace();
        refreshFromViewModel();
    }

    public Node controls() {
        return controls;
    }

    public Node workspace() {
        return workspace;
    }

    private void buildControls() {
        controls.setPadding(new Insets(12));
        controls.getStyleClass().addAll("control-toolbar", "control-stack");

        Label title = new Label("Creatures");
        title.getStyleClass().add("panel-title");

        CreatureFilterPane filterPane = new CreatureFilterPane(
                new CreatureFilterOptionsViewData(
                        viewModel.snapshot().filterOptions().sizes(),
                        viewModel.snapshot().filterOptions().types(),
                        viewModel.snapshot().filterOptions().subtypes(),
                        viewModel.snapshot().filterOptions().biomes(),
                        viewModel.snapshot().filterOptions().alignments(),
                        viewModel.snapshot().filterOptions().challengeRatings()),
                FilterPaneConfig.catalogDefaults(),
                viewModel::applyFilters);
        controls.getChildren().setAll(
                title,
                filterPane
        );
    }

    private void buildWorkspace() {
        workspace.setPadding(new Insets(12));
        workspace.getStyleClass().add("surface-root");
        VBox.setVgrow(table, Priority.ALWAYS);

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No creatures found."));
        table.getColumns().setAll(
                textColumn("Name", CreaturesCatalogViewData.Row::name),
                textColumn("CR", CreaturesCatalogViewData.Row::challengeRating),
                textColumn("Type", CreaturesCatalogViewData.Row::creatureType),
                textColumn("Size", CreaturesCatalogViewData.Row::size),
                textColumn("Alignment", CreaturesCatalogViewData.Row::alignment),
                numberColumn("XP", row -> row.xp()),
                numberColumn("HP", row -> row.hitPoints()),
                numberColumn("AC", row -> row.armorClass())
        );
        table.getSelectionModel().selectedItemProperty().addListener((obs, oldValue, newValue) ->
                viewModel.selectCreature(newValue == null ? null : newValue.id()));

        previousButton.setOnAction(event -> viewModel.pageBy(-1));

        nextButton.setOnAction(event -> viewModel.pageBy(1));

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox footer = new HBox(8, previousButton, nextButton, spacer, pageSummaryLabel);
        footer.setAlignment(Pos.CENTER_LEFT);

        workspace.getChildren().setAll(table, footer, statusLabel);
    }

    private void refreshFromViewModel() {
        CreaturesCatalogSnapshot snapshot = viewModel.snapshot();
        table.getItems().setAll(snapshot.page().rows());
        previousButton.setDisable(!snapshot.page().previousPageAvailable());
        nextButton.setDisable(!snapshot.page().nextPageAvailable());
        pageSummaryLabel.setText(snapshot.page().pageSummaryText());
        statusLabel.setText(snapshot.status().text());
        statusLabel.getStyleClass().add("status-label");
        statusLabel.setVisible(snapshot.status().visible());
        statusLabel.setManaged(snapshot.status().visible());
        updateStatusStyle(snapshot.status().error());
    }

    private void updateStatusStyle(boolean error) {
        statusLabel.getStyleClass().removeAll("status-label-error", "status-label-success");
        statusLabel.getStyleClass().add(error
                ? "status-label-error"
                : "status-label-success");
    }

    private static TableColumn<CreaturesCatalogViewData.Row, String> textColumn(
            String title,
            java.util.function.Function<CreaturesCatalogViewData.Row, String> valueFactory
    ) {
        TableColumn<CreaturesCatalogViewData.Row, String> column = new TableColumn<>(title);
        column.setCellValueFactory(cell -> new javafx.beans.property.SimpleStringProperty(valueFactory.apply(cell.getValue())));
        return column;
    }

    private static TableColumn<CreaturesCatalogViewData.Row, Number> numberColumn(
            String title,
            java.util.function.ToIntFunction<CreaturesCatalogViewData.Row> valueFactory
    ) {
        TableColumn<CreaturesCatalogViewData.Row, Number> column = new TableColumn<>(title);
        column.setCellValueFactory(cell -> new javafx.beans.property.SimpleIntegerProperty(valueFactory.applyAsInt(cell.getValue())));
        return column;
    }
}
