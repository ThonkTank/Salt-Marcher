package features.catalog.adapter.javafx;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import javafx.beans.binding.Bindings;
import javafx.beans.binding.BooleanBinding;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

/** Shared compact control composition for every Catalog section. */
public class CatalogControlsScaffold extends VBox {

    private final Label purpose = new Label();
    private final HBox search = new HBox();
    private final FlowPane filters = new FlowPane();
    private final FlowPane chips = new FlowPane();
    private final FlowPane actions = new FlowPane();
    private final VBox feedback = new VBox();

    public CatalogControlsScaffold(String purposeText) {
        purpose.setText(Objects.requireNonNull(purposeText, "purposeText"));
        purpose.getStyleClass().add("catalog-controls-section-title");
        getStyleClass().add("catalog-controls-scaffold");
        search.getStyleClass().add("catalog-controls-search-row");
        filters.getStyleClass().add("catalog-controls-filter-row");
        chips.getStyleClass().add("catalog-controls-chip-row");
        actions.getStyleClass().add("catalog-controls-action-row");
        feedback.getStyleClass().add("catalog-controls-feedback");
        getChildren().setAll(purpose, search, filters, chips, actions, feedback);
        hideWhenEmpty(search);
        hideWhenEmpty(filters);
        hideWhenEmpty(chips);
        hideWhenEmpty(actions);
        hideWhenEmpty(feedback);
    }

    public final void setSearch(Node primary, Node... trailing) {
        Node requiredPrimary = Objects.requireNonNull(primary, "primary");
        search.getChildren().setAll(requiredPrimary);
        search.getChildren().addAll(nonNullNodes(trailing));
        HBox.setHgrow(requiredPrimary, Priority.ALWAYS);
        show(search, true);
    }

    public final void setFilters(Node... controls) {
        setRow(filters, Arrays.asList(controls));
    }

    public final void setActions(Node... controls) {
        setRow(actions, Arrays.asList(controls));
    }

    public final void setChips(List<? extends Node> controls) {
        setRow(chips, controls);
    }

    public final void setFeedback(Node... controls) {
        feedback.visibleProperty().unbind();
        feedback.managedProperty().unbind();
        feedback.getChildren().setAll(nonNullNodes(controls));
        if (feedback.getChildren().isEmpty()) {
            show(feedback, false);
            return;
        }
        BooleanBinding hasVisibleContent = Bindings.createBooleanBinding(
                () -> feedback.getChildren().stream().anyMatch(Node::isVisible),
                feedback.getChildren().stream().map(Node::visibleProperty).toArray(javafx.beans.Observable[]::new));
        feedback.visibleProperty().bind(hasVisibleContent);
        feedback.managedProperty().bind(hasVisibleContent);
    }

    public static Node field(String labelText, Node... controls) {
        Label label = new Label(Objects.requireNonNull(labelText, "labelText"));
        label.getStyleClass().add("catalog-control-field-label");
        HBox field = new HBox();
        field.getStyleClass().add("catalog-control-field");
        field.getChildren().add(label);
        field.getChildren().addAll(nonNullNodes(controls));
        return field;
    }

    public static Node rangeField(String labelText, Node minimum, Node maximum) {
        Label separator = new Label("–");
        separator.getStyleClass().add("catalog-control-range-separator");
        return field(labelText, Objects.requireNonNull(minimum, "minimum"), separator,
                Objects.requireNonNull(maximum, "maximum"));
    }

    public static Node chip(String labelText, Runnable removeAction) {
        String requiredLabel = Objects.requireNonNull(labelText, "labelText");
        Button remove = new Button("×");
        remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
        remove.setAccessibleText("Entfernen: " + requiredLabel);
        remove.setOnAction(ignored -> Objects.requireNonNull(removeAction, "removeAction").run());
        HBox chip = new HBox();
        chip.getStyleClass().add("chip");
        chip.getChildren().setAll(new Label(requiredLabel), remove);
        return chip;
    }

    private static void setRow(Pane row, List<? extends Node> controls) {
        row.getChildren().setAll(nonNullNodes(controls.toArray(Node[]::new)));
        show(row, !row.getChildren().isEmpty());
    }

    private static List<Node> nonNullNodes(Node... nodes) {
        return Arrays.stream(nodes).filter(Objects::nonNull).toList();
    }

    private static void hideWhenEmpty(Pane row) {
        show(row, false);
    }

    private static void show(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }
}
