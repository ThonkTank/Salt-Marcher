package src.view.slotcontent.controls.progressmeter;

import java.util.List;
import java.util.function.IntConsumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.controls.popup.AnchoredPopupView;

public final class ProgressMeterView extends StackPane {

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public ProgressMeterView(
            double fraction,
            String text,
            String accessibleText,
            String fillStyleClass,
            String sizeStyleClass
    ) {
        this(fraction, text, accessibleText, fillStyleClass, sizeStyleClass, null);
    }

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public ProgressMeterView(
            double fraction,
            String text,
            String accessibleText,
            String fillStyleClass,
            String sizeStyleClass,
            @Nullable PopupSpec popupSpec
    ) {
        double normalizedFraction = Math.max(0.0, Math.min(1.0, fraction));
        getStyleClass().add("progress-meter");
        if (!safe(sizeStyleClass).isBlank()) {
            getStyleClass().add(sizeStyleClass);
        }

        HBox fillHost = new HBox();
        fillHost.setMouseTransparent(true);
        Region fill = new Region();
        fill.getStyleClass().add("progress-meter-fill");
        if (!safe(fillStyleClass).isBlank()) {
            fill.getStyleClass().add(fillStyleClass);
        }
        fill.prefWidthProperty().bind(widthProperty().multiply(normalizedFraction));
        fillHost.getChildren().add(fill);

        Label overlayText = new Label(safe(text));
        overlayText.getStyleClass().add("progress-meter-text");
        overlayText.setMouseTransparent(true);

        getChildren().addAll(fillHost, overlayText);
        StackPane.setAlignment(fillHost, Pos.CENTER_LEFT);
        StackPane.setAlignment(overlayText, Pos.CENTER);
        setAccessibleText(safe(accessibleText).isBlank() ? safe(text) : safe(accessibleText));
        configurePopup(popupSpec);
    }

    private void configurePopup(@Nullable PopupSpec popupSpec) {
        if (popupSpec == null) {
            return;
        }
        if (!safe(popupSpec.tooltipText()).isBlank()) {
            Tooltip.install(this, new Tooltip(popupSpec.tooltipText()));
        }
        if (popupSpec.actions().isEmpty()) {
            return;
        }
        getStyleClass().add("clickable");
        setOnMouseClicked(event -> showAmountPopup(this, popupSpec));
    }

    private static void showAmountPopup(Node anchor, PopupSpec popupSpec) {
        AnchoredPopupView popup = new AnchoredPopupView();
        TextField field = amountField(String.valueOf(Math.max(1, popupSpec.initialAmount())));
        Button down = spinnerButton("\u25BC");
        Button up = spinnerButton("\u25B2");
        down.setOnAction(event -> field.setText(String.valueOf(Math.max(1, parse(field.getText(), 1) - 1))));
        up.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), 1) + 1)));

        HBox content = new HBox(4);
        content.getStyleClass().add("anchored-popup");
        content.setAlignment(Pos.CENTER_LEFT);
        content.getChildren().addAll(field, down, up);
        Button defaultButton = null;
        for (PopupAction action : popupSpec.actions()) {
            Button button = new Button(action.label());
            if (!safe(action.styleClass()).isBlank()) {
                button.getStyleClass().add(action.styleClass());
            }
            button.setDefaultButton(action.defaultButton());
            if (action.defaultButton()) {
                defaultButton = button;
            }
            button.setOnAction(event -> {
                popup.hide();
                action.amountHandler().accept(parse(field.getText(), 1));
            });
            content.getChildren().add(button);
        }
        if (defaultButton != null) {
            Button enterAction = defaultButton;
            field.setOnAction(event -> enterAction.fire());
        }

        popup.setContent(content);
        popup.showBelow(anchor, 8);
        popup.focusAfterShown(field);
    }

    private static TextField amountField(String initial) {
        TextField field = new TextField(initial);
        field.getStyleClass().add("text-field");
        field.setPrefWidth(56);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static Button spinnerButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("spinner-btn");
        button.setFocusTraversable(false);
        return button;
    }

    private static int parse(String text, int fallback) {
        try {
            return Integer.parseInt(safe(text));
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    public record PopupSpec(String tooltipText, int initialAmount, List<PopupAction> actions) {

        public PopupSpec {
            tooltipText = safe(tooltipText);
            initialAmount = Math.max(1, initialAmount);
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    public record PopupAction(String label, String styleClass, boolean defaultButton, IntConsumer amountHandler) {

        public PopupAction {
            label = safe(label);
            styleClass = safe(styleClass);
            amountHandler = amountHandler == null ? ignored -> { } : amountHandler;
        }
    }
}
