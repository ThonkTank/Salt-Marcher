package clean.placeholder;

import clean.navigation.input.ComposeNavigationInput;
import clean.placeholder.input.ComposePlaceholderInput;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
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
        HBox toolbarContent = new HBox(toolbarBadge);
        VBox controlsContent = new VBox();
        VBox mainContent = new VBox();
        VBox detailsContent = new VBox();
        VBox stateContent = new VBox();
        ComposeNavigationInput.SurfaceInput surface = new ComposeNavigationInput.SurfaceInput(
                resolvedInput.surfaceId(),
                resolvedInput.title(),
                resolvedInput.navigationLabel(),
                toolbarContent,
                controlsContent,
                mainContent,
                detailsContent,
                stateContent,
                null,
                null);
        composePlaceholder(surface, resolvedInput);
        return surface;
    }

    private void composePlaceholder(ComposeNavigationInput.SurfaceInput surface, ComposePlaceholderInput input) {
        HBox toolbarContent = (HBox) surface.toolbarContent();
        Label toolbarBadge = (Label) toolbarContent.getChildren().get(0);
        toolbarBadge.getStyleClass().add("toolbar-badge");

        VBox controlsPanel = (VBox) surface.controlsContent();
        controlsPanel.setSpacing(12);
        controlsPanel.setPadding(new Insets(18));
        controlsPanel.getStyleClass().add("list-card");
        Label controlsTitleLabel = new Label("Scope");
        controlsTitleLabel.getStyleClass().add("section-label");
        controlsPanel.getChildren().add(controlsTitleLabel);
        controlsPanel.getChildren().add(createLine(input.controlsLineOne()));
        controlsPanel.getChildren().add(createLine(input.controlsLineTwo()));
        controlsPanel.getChildren().add(createLine(input.controlsLineThree()));

        VBox mainPanel = (VBox) surface.mainContent();
        mainPanel.setSpacing(14);
        mainPanel.setPadding(new Insets(24));
        mainPanel.getStyleClass().add("hero-card");
        Label eyebrow = new Label("Isolierter Clean-Einstieg");
        eyebrow.getStyleClass().add("eyebrow-label");
        Label titleLabel = new Label(input.title());
        titleLabel.getStyleClass().add("hero-title");
        titleLabel.setWrapText(true);
        Label summaryLabel = new Label(input.summary() == null ? "" : input.summary());
        summaryLabel.getStyleClass().add("hero-summary");
        summaryLabel.setWrapText(true);
        Label footerLabel = new Label(
                "Diese Surface ist bewusst frei von Legacy-Code. Sie markiert den Platz fuer den vollstaendigen manuellen Neuaufbau.");
        footerLabel.getStyleClass().add("hero-footer");
        footerLabel.setWrapText(true);
        Region spacer = new Region();
        VBox.setVgrow(spacer, Priority.ALWAYS);
        mainPanel.getChildren().add(eyebrow);
        mainPanel.getChildren().add(titleLabel);
        mainPanel.getChildren().add(summaryLabel);
        mainPanel.getChildren().add(spacer);
        mainPanel.getChildren().add(footerLabel);

        VBox detailsPanel = (VBox) surface.detailsContent();
        detailsPanel.setSpacing(12);
        detailsPanel.setPadding(new Insets(18));
        detailsPanel.getStyleClass().add("list-card");
        Label detailsTitleLabel = new Label("Architecture Notes");
        detailsTitleLabel.getStyleClass().add("section-label");
        detailsPanel.getChildren().add(detailsTitleLabel);
        detailsPanel.getChildren().add(createLine(input.detailsLineOne()));
        detailsPanel.getChildren().add(createLine(input.detailsLineTwo()));
        detailsPanel.getChildren().add(createLine(input.detailsLineThree()));

        VBox statePanel = (VBox) surface.stateContent();
        statePanel.setSpacing(12);
        statePanel.setPadding(new Insets(18));
        statePanel.getStyleClass().add("list-card");
        Label stateTitleLabel = new Label("Rebuild Status");
        stateTitleLabel.getStyleClass().add("section-label");
        statePanel.getChildren().add(stateTitleLabel);
        statePanel.getChildren().add(createLine(input.stateLineOne()));
        statePanel.getChildren().add(createLine(input.stateLineTwo()));
        statePanel.getChildren().add(createLine(input.stateLineThree()));
    }

    private HBox createLine(String textValue) {
        HBox row = new HBox(8);
        row.setAlignment(Pos.TOP_LEFT);
        Label bullet = new Label("*");
        bullet.getStyleClass().add("bullet-label");
        Label text = new Label(textValue == null || textValue.isBlank() ? "Noch keine Eintraege definiert." : textValue);
        text.setWrapText(true);
        text.getStyleClass().add("bullet-text");
        HBox.setHgrow(text, Priority.ALWAYS);
        row.getChildren().add(bullet);
        row.getChildren().add(text);
        return row;
    }
}
