package clean.placeholder;

import clean.navigation.input.ComposeNavigationInput;
import clean.placeholder.input.ComposePlaceholderInput;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * Placeholder surface owner for phase-1 clean capability targets.
 */
@SuppressWarnings("unused")
public final class PlaceholderObject {

    public ComposeNavigationInput.SurfaceInput composePlaceholder(ComposePlaceholderInput input) {
        ComposePlaceholderInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        Label toolbarBadge = new Label("Phase 1 Placeholder");
        toolbarBadge.getStyleClass().add("toolbar-badge");
        Label controlsTitleLabel = new Label("Scope");
        controlsTitleLabel.getStyleClass().add("section-label");
        VBox controlsList = new VBox(10);
        controlsList.setFillWidth(true);
        java.util.List<String> controlsItems = resolvedInput.controlsItems() == null ? java.util.List.of() : resolvedInput.controlsItems();
        for (String item : controlsItems) {
            if (item == null || item.isBlank()) {
                continue;
            }
            Label bullet = new Label("*");
            bullet.getStyleClass().add("bullet-label");
            Label text = new Label(item);
            text.setWrapText(true);
            text.getStyleClass().add("bullet-text");
            HBox row = new HBox(8, bullet, text);
            row.setAlignment(Pos.TOP_LEFT);
            HBox.setHgrow(text, Priority.ALWAYS);
            controlsList.getChildren().add(row);
        }
        if (controlsList.getChildren().isEmpty()) {
            Label empty = new Label("Noch keine Eintraege definiert.");
            empty.getStyleClass().add("bullet-text");
            controlsList.getChildren().add(empty);
        }
        VBox controlsPanel = new VBox(12, controlsTitleLabel, controlsList);
        controlsPanel.getStyleClass().add("list-card");
        controlsPanel.setPadding(new Insets(18));

        Label eyebrow = new Label("Isolierter Clean-Einstieg");
        eyebrow.getStyleClass().add("eyebrow-label");
        Label titleLabel = new Label(resolvedInput.title());
        titleLabel.getStyleClass().add("hero-title");
        titleLabel.setWrapText(true);
        Label summaryLabel = new Label(resolvedInput.summary() == null ? "" : resolvedInput.summary());
        summaryLabel.getStyleClass().add("hero-summary");
        summaryLabel.setWrapText(true);
        Label footerLabel = new Label(
                "Diese Surface ist bewusst frei von Legacy-Code. Sie markiert den Platz fuer den vollstaendigen manuellen Neuaufbau.");
        footerLabel.getStyleClass().add("hero-footer");
        footerLabel.setWrapText(true);
        Region spacer = new Region();
        VBox.setVgrow(spacer, Priority.ALWAYS);
        VBox mainPanel = new VBox(14, eyebrow, titleLabel, summaryLabel, spacer, footerLabel);
        mainPanel.getStyleClass().add("hero-card");
        mainPanel.setPadding(new Insets(24));

        Label detailsTitleLabel = new Label("Architecture Notes");
        detailsTitleLabel.getStyleClass().add("section-label");
        VBox detailsList = new VBox(10);
        detailsList.setFillWidth(true);
        java.util.List<String> detailItems = resolvedInput.detailItems() == null ? java.util.List.of() : resolvedInput.detailItems();
        for (String item : detailItems) {
            if (item == null || item.isBlank()) {
                continue;
            }
            Label bullet = new Label("*");
            bullet.getStyleClass().add("bullet-label");
            Label text = new Label(item);
            text.setWrapText(true);
            text.getStyleClass().add("bullet-text");
            HBox row = new HBox(8, bullet, text);
            row.setAlignment(Pos.TOP_LEFT);
            HBox.setHgrow(text, Priority.ALWAYS);
            detailsList.getChildren().add(row);
        }
        if (detailsList.getChildren().isEmpty()) {
            Label empty = new Label("Noch keine Eintraege definiert.");
            empty.getStyleClass().add("bullet-text");
            detailsList.getChildren().add(empty);
        }
        VBox detailsPanel = new VBox(12, detailsTitleLabel, detailsList);
        detailsPanel.getStyleClass().add("list-card");
        detailsPanel.setPadding(new Insets(18));

        Label stateTitleLabel = new Label("Rebuild Status");
        stateTitleLabel.getStyleClass().add("section-label");
        VBox stateList = new VBox(10);
        stateList.setFillWidth(true);
        java.util.List<String> stateItems = resolvedInput.stateItems() == null ? java.util.List.of() : resolvedInput.stateItems();
        for (String item : stateItems) {
            if (item == null || item.isBlank()) {
                continue;
            }
            Label bullet = new Label("*");
            bullet.getStyleClass().add("bullet-label");
            Label text = new Label(item);
            text.setWrapText(true);
            text.getStyleClass().add("bullet-text");
            HBox row = new HBox(8, bullet, text);
            row.setAlignment(Pos.TOP_LEFT);
            HBox.setHgrow(text, Priority.ALWAYS);
            stateList.getChildren().add(row);
        }
        if (stateList.getChildren().isEmpty()) {
            Label empty = new Label("Noch keine Eintraege definiert.");
            empty.getStyleClass().add("bullet-text");
            stateList.getChildren().add(empty);
        }
        VBox statePanel = new VBox(12, stateTitleLabel, stateList);
        statePanel.getStyleClass().add("list-card");
        statePanel.setPadding(new Insets(18));

        return new ComposeNavigationInput.SurfaceInput(
                resolvedInput.surfaceId(),
                resolvedInput.title(),
                resolvedInput.navigationLabel(),
                new HBox(toolbarBadge),
                controlsPanel,
                mainPanel,
                detailsPanel,
                statePanel,
                null,
                null);
    }
}
