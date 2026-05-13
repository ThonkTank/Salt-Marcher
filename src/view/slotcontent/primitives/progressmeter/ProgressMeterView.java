package src.view.slotcontent.primitives.progressmeter;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class ProgressMeterView extends StackPane {

    private final HBox fillHost = new HBox();
    private final Region fill = new Region();
    private final Label overlayText = new Label();
    private final HBox popupContent = new HBox(4);
    private final TextField amountField = PopupActions.amountField("1");
    private final Button downButton = PopupActions.spinnerButton("\u25BC");
    private final Button upButton = PopupActions.spinnerButton("\u25B2");
    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final AnchoredPopupView popupView = new AnchoredPopupView(popupContent, () -> this, () -> amountField);
    private final MeterVisual meterVisual = new MeterVisual(this, fill, overlayText);
    private final PopupActions popupActions = new PopupActions(popupContent, amountField, downButton, upButton);

    private ProgressMeterContentModel contentModel = new ProgressMeterContentModel();
    private Consumer<ProgressMeterViewInputEvent> viewInputEventHandler = ignored -> { };
    private javafx.beans.value.ChangeListener<ProgressMeterContentModel.MeterState> meterStateListener;

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
        popupActions.configure();
        popupView.bind(popupContentModel);
        popupView.onViewInputEvent(event -> {
            if (event.interaction().isHidden()) {
                contentModel.applyPopupInteraction(ProgressMeterContentModel.PopupInteraction.hide());
            }
        });
        bind(contentModel);
    }

    public void bind(ProgressMeterContentModel contentModel) {
        if (meterStateListener != null) {
            this.contentModel.meterStateProperty().removeListener(meterStateListener);
        }
        this.contentModel = contentModel == null ? new ProgressMeterContentModel() : contentModel;
        meterStateListener = (ignored, before, after) -> applyMeterState(after);
        this.contentModel.meterStateProperty().addListener(meterStateListener);
        applyMeterState(this.contentModel.currentMeterState());
    }

    public void onViewInputEvent(Consumer<ProgressMeterViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void applyMeterState(ProgressMeterContentModel.MeterState meterState) {
        ProgressMeterContentModel.MeterState safeState = meterState == null
                ? ProgressMeterContentModel.MeterState.initial()
                : meterState;
        meterVisual.apply(safeState);
        updateClickTarget(safeState.hasPopupActions());
        popupActions.apply(safeState);
        if (safeState.popupVisible()) {
            popupContentModel.showBelow(8.0, true);
        } else {
            popupContentModel.hide();
        }
    }

    private void updateClickTarget(boolean clickable) {
        getStyleClass().remove("clickable");
        setOnMouseClicked(null);
        if (clickable) {
            getStyleClass().add("clickable");
            setOnMouseClicked(event -> contentModel.applyPopupInteraction(ProgressMeterContentModel.PopupInteraction.show()));
        }
    }

    private void emitPopupAction(String actionId, int amount) {
        viewInputEventHandler.accept(new ProgressMeterViewInputEvent(actionId, amount));
        contentModel.applyPopupInteraction(ProgressMeterContentModel.PopupInteraction.hide());
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static final class MeterVisual {

        private final ProgressMeterView host;
        private final Region fill;
        private final Label overlayText;
        private String currentFillStyleClass = "";
        private String currentSizeStyleClass = "";
        private Tooltip installedTooltip = new Tooltip();
        private boolean tooltipInstalled;

        private MeterVisual(ProgressMeterView host, Region fill, Label overlayText) {
            this.host = host;
            this.fill = fill;
            this.overlayText = overlayText;
        }

        private void apply(ProgressMeterContentModel.MeterState meterState) {
            overlayText.setText(meterState.text());
            host.setAccessibleText(meterState.accessibleText());
            updateSizeStyleClass(meterState);
            updateFillStyleClass(meterState);
            FxAccess.bindWidth(fill, host, meterState.fraction());
            installTooltip(meterState);
        }

        private void installTooltip(ProgressMeterContentModel.MeterState meterState) {
            if (tooltipInstalled) {
                Tooltip.uninstall(host, installedTooltip);
            }
            if (!meterState.hasTooltip()) {
                tooltipInstalled = false;
                return;
            }
            installedTooltip = new Tooltip(meterState.tooltipText());
            Tooltip.install(host, installedTooltip);
            tooltipInstalled = true;
        }

        private void updateFillStyleClass(ProgressMeterContentModel.MeterState meterState) {
            if (!safe(currentFillStyleClass).isBlank()) {
                FxAccess.removeStyle(fill, currentFillStyleClass);
            }
            currentFillStyleClass = meterState.fillStyleClass();
            if (meterState.hasFillStyle()) {
                FxAccess.addStyle(fill, currentFillStyleClass);
            }
        }

        private void updateSizeStyleClass(ProgressMeterContentModel.MeterState meterState) {
            if (!safe(currentSizeStyleClass).isBlank()) {
                FxAccess.removeStyle(host, currentSizeStyleClass);
            }
            currentSizeStyleClass = meterState.sizeStyleClass();
            if (meterState.hasSizeStyle()) {
                FxAccess.addStyle(host, currentSizeStyleClass);
            }
        }
    }

    private final class PopupActions {

        private final HBox popupContent;
        private final TextField amountField;
        private final Button downButton;
        private final Button upButton;
        private int amountFieldSyncDepth;

        private PopupActions(
                HBox popupContent,
                TextField amountField,
                Button downButton,
                Button upButton
        ) {
            this.popupContent = popupContent;
            this.amountField = amountField;
            this.downButton = downButton;
            this.upButton = upButton;
        }

        private void configure() {
            FxAccess.addStyle(popupContent, "anchored-popup");
            popupContent.setAlignment(Pos.CENTER_LEFT);
            downButton.setOnAction(event -> contentModel.applyPopupInteraction(
                    ProgressMeterContentModel.PopupInteraction.decrease()));
            upButton.setOnAction(event -> contentModel.applyPopupInteraction(
                    ProgressMeterContentModel.PopupInteraction.increase()));
            amountField.textProperty().addListener((ignored, before, after) -> {
                if (!isSyncingAmountField()) {
                    contentModel.applyPopupInteraction(ProgressMeterContentModel.PopupInteraction.amountDraft(after));
                }
            });
        }

        private void apply(ProgressMeterContentModel.MeterState meterState) {
            syncAmountField(() -> amountField.setText(String.valueOf(meterState.amountDraft())));
            rebuildPopupActions(meterState.popupActions(), meterState.amountDraft());
        }

        private void rebuildPopupActions(List<ProgressMeterContentModel.PopupActionModel> popupActions, int amount) {
            FxAccess.setChildren(popupContent, amountField, downButton, upButton);
            Button defaultButton = null;
            for (ProgressMeterContentModel.PopupActionModel action : popupActions) {
                Button button = new Button(action.label());
                if (!safe(action.styleClass()).isBlank()) {
                    FxAccess.addStyle(button, action.styleClass());
                }
                button.setDefaultButton(action.defaultButton());
                if (action.defaultButton()) {
                    defaultButton = button;
                }
                button.setOnAction(event -> emitPopupAction(action.actionId(), amount));
                FxAccess.addChildren(popupContent, button);
            }
            Button enterAction = defaultButton;
            amountField.setOnAction(enterAction == null ? null : event -> enterAction.fire());
        }

        private boolean isSyncingAmountField() {
            return amountFieldSyncDepth > 0;
        }

        private void syncAmountField(Runnable syncAction) {
            amountFieldSyncDepth++;
            try {
                syncAction.run();
            } finally {
                amountFieldSyncDepth--;
            }
        }

        private static TextField amountField(String initial) {
            TextField field = new TextField(initial);
            FxAccess.addStyle(field, "text-field");
            field.setPrefWidth(56);
            field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
            return field;
        }

        private static Button spinnerButton(String text) {
            Button button = new Button(text);
            FxAccess.addStyle(button, "spinner-btn");
            button.setFocusTraversable(false);
            return button;
        }
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class FxAccess {

        private static void addStyle(Node node, String styleClass) {
            node.getStyleClass().add(styleClass);
        }

        private static void addChildren(Pane parent, Node... children) {
            parent.getChildren().addAll(children);
        }

        private static void removeStyle(Node node, String styleClass) {
            node.getStyleClass().remove(styleClass);
        }

        private static void setChildren(Pane parent, Node... children) {
            parent.getChildren().setAll(children);
        }

        private static void bindWidth(Region target, Region host, double normalizedFraction) {
            target.prefWidthProperty().unbind();
            target.prefWidthProperty().bind(host.widthProperty().multiply(normalizedFraction));
        }
    }
}
