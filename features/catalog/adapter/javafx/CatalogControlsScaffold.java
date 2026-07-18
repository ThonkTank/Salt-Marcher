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

    private final HBox toolbar = new HBox();
    private final FlowPane filters = new FlowPane();
    private final FlowPane chips = new FlowPane();
    private final VBox feedback = new VBox();
    private List<Node> searchControls = List.of();
    private List<Node> actionControls = List.of();

    public CatalogControlsScaffold() {
        getStyleClass().add("catalog-controls-scaffold");
        toolbar.getStyleClass().add("catalog-controls-toolbar");
        filters.getStyleClass().add("catalog-controls-filter-row");
        chips.getStyleClass().add("catalog-controls-chip-row");
        feedback.getStyleClass().add("catalog-controls-feedback");
        getChildren().setAll(toolbar, filters, chips, feedback);
        hideWhenEmpty(toolbar);
        hideWhenEmpty(filters);
        hideWhenEmpty(chips);
        hideWhenEmpty(feedback);
    }

    public final void setSearch(Node primary, Node... trailing) {
        Node requiredPrimary = Objects.requireNonNull(primary, "primary");
        java.util.ArrayList<Node> next = new java.util.ArrayList<>();
        next.add(requiredPrimary);
        next.addAll(nonNullNodes(trailing));
        searchControls = List.copyOf(next);
        refreshToolbar();
    }

    public final void setFilters(Node... controls) {
        setRow(filters, Arrays.asList(controls));
    }

    public final void setActions(Node... controls) {
        actionControls = List.copyOf(nonNullNodes(controls));
        refreshToolbar();
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

    private void refreshToolbar() {
        java.util.ArrayList<Node> next = new java.util.ArrayList<>(searchControls);
        next.addAll(actionControls);
        toolbar.getChildren().setAll(next);
        if (!searchControls.isEmpty()) {
            HBox.setHgrow(searchControls.get(0), Priority.ALWAYS);
        }
        show(toolbar, !next.isEmpty());
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
