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
import src.view.creatures.Controller.CreaturesController;
import src.view.creatures.Model.CreaturesCatalogViewData;
import src.view.creatures.Model.CreaturesModel;

import java.util.Objects;

public final class CreaturesView {

    private final CreaturesModel model;
    private final CreaturesController controller;
    private final VBox controls = new VBox(10);
    private final VBox workspace = new VBox(10);
    private final TableView<CreaturesCatalogViewData.Row> table = new TableView<>();
    private final Label pageSummaryLabel = new Label();
    private final Label statusLabel = new Label();

    public CreaturesView(CreaturesModel model, CreaturesController controller) {
        this.model = Objects.requireNonNull(model, "model");
        this.controller = Objects.requireNonNull(controller, "controller");
        buildControls();
        buildWorkspace();
        bindStatus();
    }

    public Node controls() {
        return controls;
    }

    public Node workspace() {
        return workspace;
    }

    private void buildControls() {
        var filters = model.filters();
        controls.setPadding(new Insets(12));
        controls.getStyleClass().addAll("dungeon-editor-toolbar", "dungeon-editor-sidebar");

        Label title = new Label("Creatures");
        title.getStyleClass().add("editor-panel-title");

        CreatureFilterPane filterPane = new CreatureFilterPane(
                new src.view.creatures.Model.CreatureFilterOptionsViewData(
                        filters.options().sizeOptions(),
                        filters.options().typeOptions(),
                        filters.options().subtypeOptions(),
                        filters.options().biomeOptions(),
                        filters.options().alignmentOptions(),
                        filters.options().challengeRatingOptions()),
                filters.selection(),
                FilterPaneConfig.catalogDefaults(),
                controller::applyFilters);
        controls.getChildren().setAll(
                title,
                filterPane
        );
    }

    private void buildWorkspace() {
        var catalog = model.catalog();
        workspace.setPadding(new Insets(12));
        workspace.getStyleClass().add("scene-pane");
        VBox.setVgrow(table, Priority.ALWAYS);

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No creatures found."));
        table.setItems(catalog.rows());
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
                controller.selectCreature(newValue == null ? null : newValue.id()));

        Button previousButton = new Button("Previous");
        previousButton.disableProperty().bind(catalog.previousPageAvailableProperty().not());
        previousButton.setOnAction(event -> controller.previousPage());

        Button nextButton = new Button("Next");
        nextButton.disableProperty().bind(catalog.nextPageAvailableProperty().not());
        nextButton.setOnAction(event -> controller.nextPage());

        pageSummaryLabel.textProperty().bind(catalog.pageSummaryTextProperty());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox footer = new HBox(8, previousButton, nextButton, spacer, pageSummaryLabel);
        footer.setAlignment(Pos.CENTER_LEFT);

        workspace.getChildren().setAll(table, footer, statusLabel);
    }

    private void bindStatus() {
        var status = model.status();
        statusLabel.textProperty().bind(status.statusTextProperty());
        statusLabel.getStyleClass().add("status-label");
        statusLabel.visibleProperty().bind(status.statusVisibleProperty());
        statusLabel.managedProperty().bind(status.statusVisibleProperty());
        status.statusErrorProperty().addListener((obs, oldValue, newValue) -> updateStatusStyle());
        updateStatusStyle();
    }

    private void updateStatusStyle() {
        statusLabel.getStyleClass().removeAll("status-label-error", "status-label-success");
        statusLabel.getStyleClass().add(model.status().statusErrorProperty().get()
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
