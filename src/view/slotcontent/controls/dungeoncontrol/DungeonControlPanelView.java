package src.view.slotcontent.controls.dungeoncontrol;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public class DungeonControlPanelView extends VBox {

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonControlPanelView(String titleText) {
        setSpacing(6);
        setPadding(new Insets(8));
        getStyleClass().add("surface-root");
        if (titleText != null && !titleText.isBlank()) {
            getChildren().add(new Label(titleText));
        }
    }

    protected final void addControl(Node control) {
        getChildren().add(control);
    }

    protected final HBox compactControlRow(Node... controls) {
        HBox row = new HBox(6, controls);
        row.getStyleClass().add("dungeon-control-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    protected final HBox compactControlGroup(Node... controls) {
        HBox group = new HBox(0, controls);
        group.getStyleClass().add("dungeon-control-group");
        group.setAlignment(Pos.CENTER_LEFT);
        group.setMaxWidth(Region.USE_PREF_SIZE);
        return group;
    }

    protected final ScrollPane compactControlScroller(Node content) {
        ScrollPane scroller = new ScrollPane(content);
        scroller.getStyleClass().add("dungeon-control-scroll");
        scroller.setFitToHeight(true);
        scroller.setFitToWidth(false);
        scroller.setHbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        scroller.setVbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scroller;
    }

    protected final void bindAction(Button button, Runnable action) {
        button.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    protected final void describe(Node node, String description) {
        if (node == null || description == null || description.isBlank()) {
            return;
        }
        node.setAccessibleText(description);
        if (node instanceof Control control) {
            control.setTooltip(new Tooltip(description));
        }
    }

    protected final AnchoredPopupView createOverlayPopup(Consumer<String> action, String... labels) {
        AnchoredPopupView popup = new AnchoredPopupView();
        VBox content = new VBox(6);
        content.setPadding(new Insets(8));
        content.getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
        for (String label : labels) {
            content.getChildren().add(overlayOption(label, action, popup));
        }
        popup.setContent(content);
        return popup;
    }

    protected final void togglePopup(AnchoredPopupView popup, Node anchor) {
        popup.toggleBelow(anchor, null);
    }

    protected final Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    protected final Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    private Button overlayOption(String label, Consumer<String> action, AnchoredPopupView popup) {
        Button button = new Button(label);
        button.getStyleClass().add("tool-btn");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> {
            if (action != null) {
                action.accept(label);
            }
            popup.hide();
        });
        return button;
    }
}
