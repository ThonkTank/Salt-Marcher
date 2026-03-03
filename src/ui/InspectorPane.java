package ui;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.*;
import ui.components.StatBlockPane;

/**
 * Right inspector panel with a vertical split: context-dependent top section
 * (encounter roster, combat tracker, etc.) and a collapsible stat block bottom section.
 * ONE consistent location for all stat block display.
 */
public class InspectorPane extends VBox {

    private final VBox contextSection;
    private final VBox detailSection;
    private final VBox detailContent;
    private final Label detailTitle;
    private final ScrollPane detailScroll;

    private Long displayedCreatureId = null;

    public InspectorPane() {
        setPrefWidth(380);
        setMinWidth(320);
        getStyleClass().add("inspector-pane");

        // ---- Top: context-dependent content (encounter roster, combat tracker, etc.) ----
        // No outer ScrollPane — each content pane handles its own internal scrolling.
        // Direct VBox placement lets VGrow propagate so child panes can pin buttons at bottom.
        contextSection = new VBox();
        VBox.setVgrow(contextSection, Priority.ALWAYS);

        // ---- Divider ----
        Region divider = ThemeColors.controlSeparator();

        // ---- Bottom: stat block (collapsible) ----
        detailTitle = new Label();
        detailTitle.getStyleClass().add("bold");
        Button closeBtn = new Button("\u00d7");
        closeBtn.getStyleClass().addAll("compact", "remove-btn");
        closeBtn.setAccessibleText("Stat Block schliessen");
        closeBtn.setOnAction(e -> hideStatBlock());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox detailHeader = new HBox(8, detailTitle, spacer, closeBtn);
        detailHeader.setAlignment(Pos.CENTER_LEFT);
        detailHeader.setPadding(new Insets(4, 8, 4, 8));
        detailHeader.getStyleClass().add("stat-block-fixed-header");

        detailContent = new VBox();
        detailScroll = new ScrollPane(detailContent);
        detailScroll.setFitToWidth(true);
        detailScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(detailScroll, Priority.ALWAYS);

        detailSection = new VBox(detailHeader, detailScroll);
        detailSection.getStyleClass().add("stat-block-fixed-panel");
        detailSection.setVisible(false);
        detailSection.setManaged(false);
        detailSection.setPrefHeight(280);
        detailSection.setMinHeight(150);

        getChildren().addAll(contextSection, divider, detailSection);
    }

    /** Replace the top section content (encounter roster, combat tracker, initiative pane, etc.) */
    public void setContextContent(Node content) {
        contextSection.getChildren().setAll(content);
        VBox.setVgrow(content, Priority.ALWAYS);
    }

    /**
     * Show a stat block in the bottom detail section. Toggles: clicking the same
     * creature a second time collapses the panel. Use {@link #ensureStatBlock} for
     * non-toggling display (e.g. auto-show on turn advance).
     */
    public void showStatBlock(Long creatureId) {
        if (creatureId == null) return;
        if (creatureId.equals(displayedCreatureId)) { hideStatBlock(); return; }
        loadStatBlock(creatureId);
    }

    /** Show a stat block without toggling. Used by auto-show (e.g. nextTurn). */
    public void ensureStatBlock(Long creatureId) {
        if (creatureId == null) return;
        if (creatureId.equals(displayedCreatureId)) return;
        loadStatBlock(creatureId);
    }

    private void loadStatBlock(Long creatureId) {
        displayedCreatureId = creatureId;
        detailContent.getChildren().setAll(StatBlockPane.createAsyncContainer(creatureId));
        detailTitle.setText("Stat Block");
        detailSection.setVisible(true);
        detailSection.setManaged(true);
        detailScroll.setVvalue(0);
    }

    /** Show a stat block with a specific title. */
    public void showStatBlock(Long creatureId, String name) {
        showStatBlock(creatureId);
        if (creatureId != null) detailTitle.setText(name);
    }

    /** Hide the stat block detail section. */
    public void hideStatBlock() {
        displayedCreatureId = null;
        detailSection.setVisible(false);
        detailSection.setManaged(false);
    }

    /** Get the ID of the currently displayed stat block creature (null if none). */
    public Long getDisplayedCreatureId() {
        return displayedCreatureId;
    }
}
