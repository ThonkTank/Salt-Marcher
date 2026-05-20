package src.view.slotcontent.primitives.progressmeter;

import java.util.function.Consumer;
import javafx.application.Platform;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Bounds;
import javafx.geometry.Pos;
import javafx.scene.AccessibleRole;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.stage.Popup;

public final class ProgressMeterView extends StackPane {

    private static final Object BOUND_MODEL_KEY = new Object();
    private static final Object METER_STATE_LISTENER_KEY = new Object();

    private final HBox fillHost = new HBox();
    private final Region fill = new Region();
    private final Label overlayText = new Label();
    private final HBox popupContent = new HBox(4);
    private final TextField amountField = amountField("1");
    private final Button downButton = spinnerButton("\u25BC");
    private final Button upButton = spinnerButton("\u25B2");
    private final Popup popup = new Popup();
    private Tooltip installedTooltip = new Tooltip();

    private Consumer<ProgressMeterViewInputEvent> viewInputEventHandler = ignored -> { };

    public ProgressMeterView() {
        getStyleClass().add("progress-meter");
        fillHost.setMouseTransparent(true);
        FxAccess.addStyle(fill, "progress-meter-fill");
        FxAccess.bindWidth(fill, this, 0.0);
        FxAccess.addChildren(fillHost, fill);

        FxAccess.addStyle(overlayText, "progress-meter-text");
        overlayText.setMouseTransparent(true);

        FxAccess.addChildren(this, fillHost, overlayText);
        setAlignment(fillHost, Pos.CENTER_LEFT);
        setAlignment(overlayText, Pos.CENTER);
        configurePopup();
        setAccessibleRole(AccessibleRole.PROGRESS_INDICATOR);
    }

    public void bind(ProgressMeterContentModel contentModel) {
        removeCurrentMeterStateListener();
        if (contentModel == null) {
            applyUnboundMeterState();
            return;
        }
        ChangeListener<ProgressMeterContentModel.MeterState> listener =
                (ignored, before, after) -> applyMeterState(after);
        contentModel.meterStateProperty().addListener(listener);
        getProperties().put(BOUND_MODEL_KEY, contentModel);
        getProperties().put(METER_STATE_LISTENER_KEY, listener);
        applyMeterState(contentModel.currentMeterState());
    }

    public void onViewInputEvent(Consumer<ProgressMeterViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void applyMeterState(ProgressMeterContentModel.MeterState meterState) {
        overlayText.setText(meterState.text());
        setAccessibleText(meterState.accessibleText());
        setAccessibleHelp(meterState.hasPopupActions()
                ? meterState.accessibleText() + ". Enter oder Leertaste zum Bearbeiten."
                : meterState.accessibleText());
        updateSizeStyleClass(meterState);
        updateFillStyleClass(meterState);
        FxAccess.bindWidth(fill, this, meterState.fraction());
        installTooltip(meterState);
        updateClickTarget(meterState.hasPopupActions());
        syncPopupActions(meterState);
        if (!meterState.hasPopupActions()) {
            hidePopup();
        }
    }

    private void applyUnboundMeterState() {
        overlayText.setText("");
        setAccessibleText("");
        setAccessibleHelp("");
        getStyleClass().removeIf(styleClass -> styleClass.startsWith("progress-meter-"));
        fill.getStyleClass().removeIf(styleClass -> !"progress-meter-fill".equals(styleClass));
        FxAccess.bindWidth(fill, this, 0.0);
        installTooltip(false, "");
        updateClickTarget(false);
        hidePopup();
    }

    private void updateClickTarget(boolean clickable) {
        getStyleClass().remove("clickable");
        setOnMouseClicked(null);
        setOnKeyPressed(null);
        setFocusTraversable(false);
        setAccessibleRole(AccessibleRole.PROGRESS_INDICATOR);
        if (clickable) {
            getStyleClass().add("clickable");
            setOnMouseClicked(event -> showPopup());
            setOnKeyPressed(event -> {
                if (event.getCode() == KeyCode.ENTER || event.getCode() == KeyCode.SPACE) {
                    showPopup();
                    event.consume();
                }
            });
            setFocusTraversable(true);
            setAccessibleRole(AccessibleRole.BUTTON);
        }
    }

    private void configurePopup() {
        FxAccess.addStyle(popupContent, "anchored-popup");
        popupContent.setAlignment(Pos.CENTER_LEFT);
        amountField.setAccessibleText("Menge");
        amountField.setAccessibleHelp("Menge fuer die Fortschrittsaenderung");
        downButton.setAccessibleText("Menge verringern");
        upButton.setAccessibleText("Menge erhoehen");
        downButton.setOnAction(event -> adjustAmount(-1));
        upButton.setOnAction(event -> adjustAmount(1));
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        FxAccess.setPopupContent(popup, popupContent);
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                hidePopupReturningFocus();
                event.consume();
            }
        });
    }

    private void showPopup() {
        applyCss();
        layout();
        Bounds bounds = localToScreen(getBoundsInLocal());
        if (bounds == null) {
            return;
        }
        if (!popup.isShowing()) {
            popup.show(this, bounds.getMinX(), bounds.getMaxY() + 8.0);
        }
        Platform.runLater(amountField::requestFocus);
    }

    private void hidePopup() {
        if (popup.isShowing()) {
            popup.hide();
        }
    }

    private void hidePopupReturningFocus() {
        hidePopup();
        Platform.runLater(this::requestFocus);
    }

    private void installTooltip(ProgressMeterContentModel.MeterState meterState) {
        installTooltip(meterState.hasTooltip(), meterState.tooltipText());
    }

    private void installTooltip(boolean hasTooltip, String tooltipText) {
        Tooltip.uninstall(this, installedTooltip);
        if (hasTooltip) {
            installedTooltip = new Tooltip(tooltipText);
            Tooltip.install(this, installedTooltip);
        }
    }

    private void updateFillStyleClass(ProgressMeterContentModel.MeterState meterState) {
        fill.getStyleClass().removeIf(styleClass -> !"progress-meter-fill".equals(styleClass));
        if (meterState.hasFillStyle()) {
            FxAccess.addStyle(fill, meterState.fillStyleClass());
        }
    }

    private void updateSizeStyleClass(ProgressMeterContentModel.MeterState meterState) {
        getStyleClass().removeIf(styleClass -> styleClass.startsWith("progress-meter-"));
        if (meterState.hasSizeStyle()) {
            FxAccess.addStyle(this, meterState.sizeStyleClass());
        }
    }

    private void syncPopupActions(ProgressMeterContentModel.MeterState meterState) {
        amountField.setText(String.valueOf(meterState.initialAmount()));
        FxAccess.setChildren(popupContent, amountField, downButton, upButton);
        Button defaultButton = null;
        for (ProgressMeterContentModel.PopupActionModel action : meterState.popupActions()) {
            Button button = new Button(action.label());
            button.setAccessibleText(accessibleActionText(action));
            if (!action.styleClass().isBlank()) {
                FxAccess.addStyle(button, action.styleClass());
            }
            button.setDefaultButton(action.defaultButton());
            if (action.defaultButton()) {
                defaultButton = button;
            }
            button.setOnAction(event -> emitPopupAction(action.actionId()));
            FxAccess.addChildren(popupContent, button);
        }
        Button enterAction = defaultButton;
        amountField.setOnAction(enterAction == null ? null : event -> enterAction.fire());
    }

    private void adjustAmount(int delta) {
        amountField.setText(String.valueOf(Math.max(1, rawAmount() + delta)));
    }

    private void emitPopupAction(String actionId) {
        String rawText = amountField.getText();
        if (rawText.isBlank()) {
            amountField.setText("1");
            return;
        }
        int amount;
        try {
            amount = Math.max(1, Integer.parseInt(rawText));
        } catch (NumberFormatException exception) {
            amountField.setText("1");
            return;
        }
        viewInputEventHandler.accept(new ProgressMeterViewInputEvent(actionId, amount));
        hidePopupReturningFocus();
    }

    private int rawAmount() {
        try {
            return Math.max(1, Integer.parseInt(amountField.getText()));
        } catch (NumberFormatException exception) {
            return 1;
        }
    }

    private static TextField amountField(String initial) {
        TextField field = new TextField(initial);
        FxAccess.addStyle(field, "text-field");
        FxAccess.addStyle(field, "progress-meter-amount-field");
        field.setPrefColumnCount(3);
        field.setTextFormatter(new TextFormatter<>(change -> change.getControlNewText().matches("[0-9]+")
                ? change
                : null));
        return field;
    }

    private static Button spinnerButton(String text) {
        Button button = new Button(text);
        FxAccess.addStyle(button, "spinner-btn");
        return button;
    }

    @SuppressWarnings("unchecked")
    private void removeCurrentMeterStateListener() {
        Object boundModel = getProperties().remove(BOUND_MODEL_KEY);
        Object listener = getProperties().remove(METER_STATE_LISTENER_KEY);
        if (boundModel instanceof ProgressMeterContentModel model
                && listener instanceof ChangeListener<?> changeListener) {
            model.meterStateProperty()
                    .removeListener((ChangeListener<? super ProgressMeterContentModel.MeterState>) changeListener);
        }
    }

    private static String accessibleActionText(ProgressMeterContentModel.PopupActionModel action) {
        String label = safe(action.label());
        if (hasWordCharacter(label)) {
            return label;
        }
        String fromActionId = safe(action.actionId()).replaceAll("[\\s._:/\\\\-]+", " ").trim();
        return fromActionId.isBlank() ? label : fromActionId;
    }

    private static boolean hasWordCharacter(String value) {
        for (int index = 0; index < value.length(); index++) {
            if (Character.isLetterOrDigit(value.charAt(index))) {
                return true;
            }
        }
        return false;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class FxAccess {

        private static void addStyle(Node node, String styleClass) {
            if (!node.getStyleClass().contains(styleClass)) {
                node.getStyleClass().add(styleClass);
            }
        }

        private static void addChildren(Pane parent, Node... children) {
            parent.getChildren().addAll(children);
        }

        private static void setChildren(Pane parent, Node... children) {
            parent.getChildren().setAll(children);
        }

        private static void bindWidth(Region target, Region host, double normalizedFraction) {
            target.prefWidthProperty().unbind();
            target.prefWidthProperty().bind(host.widthProperty().multiply(normalizedFraction));
        }

        private static void setPopupContent(Popup popup, Node content) {
            popup.getContent().setAll(content);
        }
    }
}
