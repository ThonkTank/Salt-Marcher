package ui;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.*;
import ui.components.StatBlockPane;

/**
 * Top-right panel: shows the stat block for a selected creature.
 * Owned by AppShell; visible across all views.
 */
public class InspectorPane extends VBox {

    private final VBox detailContent;
    private final Label detailTitle;
    private final ScrollPane detailScroll;
    private final VBox detailSection;
    private final Label placeholder;

    private Long displayedCreatureId = null;

    public InspectorPane() {
        setPrefWidth(380);
        setMinWidth(320);
        getStyleClass().add("inspector-pane");

        // ---- Header ----
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
        VBox.setVgrow(detailSection, Priority.ALWAYS);

        // ---- Placeholder ----
        placeholder = new Label("Kein Stat Block ausgewählt");
        placeholder.getStyleClass().add("text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setMaxHeight(Double.MAX_VALUE);
        placeholder.setAlignment(Pos.CENTER);
        VBox.setVgrow(placeholder, Priority.ALWAYS);

        getChildren().add(placeholder);
    }

    /**
     * Show a stat block. Toggles: clicking the same creature a second time hides the panel.
     * Use {@link #ensureStatBlock} for non-toggling display (e.g. auto-show on turn advance).
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

    /** Show a stat block with a specific title. */
    public void showStatBlock(Long creatureId, String name) {
        showStatBlock(creatureId);
        if (creatureId != null) detailTitle.setText(name);
    }

    private void loadStatBlock(Long creatureId) {
        displayedCreatureId = creatureId;
        detailContent.getChildren().setAll(StatBlockPane.createAsyncContainer(creatureId));
        detailTitle.setText("Stat Block");
        detailScroll.setVvalue(0);
        getChildren().setAll(detailSection);
    }

    /** Hide the stat block and show the placeholder. */
    public void hideStatBlock() {
        displayedCreatureId = null;
        getChildren().setAll(placeholder);
    }

    /** Get the ID of the currently displayed stat block creature (null if none). */
    public Long getDisplayedCreatureId() {
        return displayedCreatureId;
    }
}
