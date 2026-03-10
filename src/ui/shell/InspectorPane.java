package ui.shell;

import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import features.creatures.api.StatBlockLoader;
import features.creatures.api.StatBlockRequest;

/**
 * Top-right panel: shows detailed info for a selected item.
 * Primary use: creature stat blocks. Also accepts arbitrary content
 * (room descriptions, item info, etc.) via {@link #showContent(String, Node)}.
 * Owned by AppShell; visible across all views.
 */
public class InspectorPane extends VBox {
    private final VBox detailContent;
    private final Label detailTitle;
    private final ScrollPane detailScroll;
    private final VBox detailSection;
    private final HBox mobFooter;
    private final TextField mobAcField;
    private final IntegerProperty mobTargetAc = new SimpleIntegerProperty(15);
    private final Label placeholder;

    private StatBlockRequest displayedRequest = null;
    private Task<?> pendingStatBlockTask = null;

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

        Label acLabel = new Label("Ziel-AC");
        acLabel.getStyleClass().add("text-secondary");
        mobAcField = new TextField("15");
        mobAcField.setPrefWidth(72);
        mobAcField.getStyleClass().addAll("quick-search-field", "inspector-mob-ac-field");
        mobAcField.textProperty().addListener((obs, oldText, newText) -> {
            try {
                mobTargetAc.set(Integer.parseInt(newText.trim()));
            } catch (NumberFormatException ignored) {
                // Keep previous valid AC while input is temporarily invalid.
            }
        });
        mobFooter = new HBox(8, acLabel, mobAcField);
        mobFooter.setAlignment(Pos.CENTER_LEFT);
        mobFooter.setPadding(new Insets(6, 8, 6, 8));
        mobFooter.getStyleClass().add("inspector-mob-footer");
        mobFooter.setVisible(false);
        mobFooter.setManaged(false);

        detailSection = new VBox(detailHeader, detailScroll, mobFooter);
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
     * Show a stat block. Toggles: selecting the same request a second time hides the panel.
     */
    public void showStatBlock(StatBlockRequest request) {
        if (request == null) return;
        if (request.equals(displayedRequest)) { hideStatBlock(); return; }
        loadStatBlock(request);
    }

    /** Show a stat block without toggling. Used by auto-show (e.g. nextTurn). */
    public void ensureStatBlock(StatBlockRequest request) {
        if (request == null) return;
        if (request.equals(displayedRequest)) return;
        loadStatBlock(request);
    }

    private void loadStatBlock(StatBlockRequest request) {
        if (pendingStatBlockTask != null) { pendingStatBlockTask.cancel(false); pendingStatBlockTask = null; }
        displayedRequest = request;
        boolean mobContext = request.mobCount() != null;
        mobFooter.setVisible(mobContext);
        mobFooter.setManaged(mobContext);
        detailTitle.setText("Stat Block");
        detailScroll.setVvalue(0);
        getChildren().setAll(detailSection);
        pendingStatBlockTask = StatBlockLoader.loadAsync(request, detailContent, mobTargetAc);
    }

    /**
     * Show arbitrary content in the inspector panel (room descriptions, item info, etc.).
     * Replaces any currently displayed stat block. Close button returns to placeholder.
     */
    public void showContent(String title, Node content) {
        if (pendingStatBlockTask != null) { pendingStatBlockTask.cancel(false); pendingStatBlockTask = null; }
        displayedRequest = null;
        detailTitle.setText(title);
        detailContent.getChildren().setAll(content);
        detailScroll.setVvalue(0);
        mobFooter.setVisible(false);
        mobFooter.setManaged(false);
        getChildren().setAll(detailSection);
    }

    /** Hide the stat block and show the placeholder. */
    public void hideStatBlock() {
        if (pendingStatBlockTask != null) {
            pendingStatBlockTask.cancel(false);
            pendingStatBlockTask = null;
        }
        displayedRequest = null;
        detailContent.getChildren().clear();
        mobFooter.setVisible(false);
        mobFooter.setManaged(false);
        getChildren().setAll(placeholder);
    }

    /** Get the ID of the currently displayed stat block creature (null if none). */
    public Long getDisplayedCreatureId() {
        return displayedRequest != null ? displayedRequest.creatureId() : null;
    }
}
