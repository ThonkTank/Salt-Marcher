package src.view.slotcontent.controls.dungeoncontrol;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;

public class DungeonControlPanelView extends VBox {

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonControlPanelView(String titleText) {
        setSpacing(10);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");
        if (titleText != null && !titleText.isBlank()) {
            getChildren().add(new Label(titleText));
        }
    }

    protected final void addControl(Node control) {
        getChildren().add(control);
    }

    protected final void bindAction(Button button, Runnable action) {
        button.setOnAction(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    protected final Popup createOverlayPopup(Consumer<String> action, String... labels) {
        Popup popup = new Popup();
        VBox content = new VBox(6);
        content.setPadding(new Insets(8));
        content.getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
        for (String label : labels) {
            content.getChildren().add(overlayOption(label, action, popup));
        }
        popup.getContent().setAll(content);
        popup.setAutoHide(true);
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                event.consume();
            }
        });
        return popup;
    }

    protected final void togglePopup(Popup popup, Node anchor) {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        var bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            popup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 2.0);
        }
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

    private Button overlayOption(String label, Consumer<String> action, Popup popup) {
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
