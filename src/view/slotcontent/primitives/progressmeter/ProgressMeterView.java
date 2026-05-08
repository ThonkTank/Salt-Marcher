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
    private final TextField amountField = amountField("1");
    private final Button downButton = spinnerButton("\u25BC");
    private final Button upButton = spinnerButton("\u25B2");
    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final AnchoredPopupView popupView = new AnchoredPopupView(popupContent, () -> this, () -> amountField);

    private ProgressMeterContentModel contentModel = new ProgressMeterContentModel();
    private Consumer<ProgressMeterViewInputEvent> viewInputEventHandler = ignored -> { };
    private javafx.beans.value.ChangeListener<ProgressMeterContentModel.MeterState> meterStateListener;
    private String currentFillStyleClass = "";
    private String currentSizeStyleClass = "";
    private boolean syncingAmountField;
    private Tooltip installedTooltip;

    public ProgressMeterView() {
        getStyleClass().add("progress-meter");
        fillHost.setMouseTransparent(true);
        FxAccess.addStyle(fill, "progress-meter-fill");
        FxAccess.bindWidth(fill, this, 0.0);
        FxAccess.addChildren(fillHost, fill);

        FxAccess.addStyle(overlayText, "progress-meter-text");
        overlayText.setMouseTransparent(true);

        getChildren().addAll(fillHost, overlayText);
        setAlignment(fillHost, Pos.CENTER_LEFT);
        setAlignment(overlayText, Pos.CENTER);
        configurePopupContent();
        popupView.bind(popupContentModel);
        popupView.onViewInputEvent(event -> {
            if (event.interaction() == src.view.slotcontent.primitives.popup.AnchoredPopupViewInputEvent.Interaction.HIDDEN) {
                contentModel.hidePopup();
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

    private void configurePopupContent() {
        FxAccess.addStyle(popupContent, "anchored-popup");
        popupContent.setAlignment(Pos.CENTER_LEFT);
        downButton.setOnAction(event -> contentModel.decreaseAmount());
        upButton.setOnAction(event -> contentModel.increaseAmount());
        amountField.textProperty().addListener((ignored, before, after) -> {
            if (!syncingAmountField) {
                contentModel.updateAmountDraft(after);
            }
        });
    }

    private void applyMeterState(ProgressMeterContentModel.MeterState meterState) {
        ProgressMeterContentModel.MeterState safeState = meterState == null
                ? ProgressMeterContentModel.MeterState.initial()
                : meterState;
        overlayText.setText(safeState.text());
        setAccessibleText(safeState.accessibleText());
        updateSizeStyleClass(safeState.sizeStyleClass());
        updateFillStyleClass(safeState.fillStyleClass());
        FxAccess.bindWidth(fill, this, safeState.fraction());
        installTooltip(safeState.tooltipText());
        boolean clickable = !safeState.popupActions().isEmpty();
        getStyleClass().remove("clickable");
        setOnMouseClicked(null);
        if (clickable) {
            getStyleClass().add("clickable");
            setOnMouseClicked(event -> contentModel.showPopup());
        }
        syncingAmountField = true;
        try {
            amountField.setText(String.valueOf(safeState.amountDraft()));
        } finally {
            syncingAmountField = false;
        }
        rebuildPopupActions(safeState.popupActions(), safeState.amountDraft());
        if (safeState.popupOpen()) {
            popupContentModel.showBelow(8.0, true);
        } else {
            popupContentModel.hide();
        }
    }

    private void rebuildPopupActions(
            List<ProgressMeterContentModel.PopupActionModel> popupActions,
            int amount
    ) {
        popupContent.getChildren().setAll(amountField, downButton, upButton);
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
            button.setOnAction(event -> {
                viewInputEventHandler.accept(new ProgressMeterViewInputEvent(action.actionId(), amount));
                contentModel.hidePopup();
            });
            FxAccess.addChildren(popupContent, button);
        }
        if (defaultButton != null) {
            Button enterAction = defaultButton;
            amountField.setOnAction(event -> enterAction.fire());
        } else {
            amountField.setOnAction(null);
        }
    }

    private void installTooltip(String tooltipText) {
        if (installedTooltip != null) {
            Tooltip.uninstall(this, installedTooltip);
            installedTooltip = null;
        }
        if (safe(tooltipText).isBlank()) {
            return;
        }
        installedTooltip = new Tooltip(tooltipText);
        Tooltip.install(this, installedTooltip);
    }

    private void updateFillStyleClass(String fillStyleClass) {
        if (!safe(currentFillStyleClass).isBlank()) {
            fill.getStyleClass().remove(currentFillStyleClass);
        }
        currentFillStyleClass = safe(fillStyleClass);
        if (!currentFillStyleClass.isBlank()) {
            fill.getStyleClass().add(currentFillStyleClass);
        }
    }

    private void updateSizeStyleClass(String sizeStyleClass) {
        if (!safe(currentSizeStyleClass).isBlank()) {
            getStyleClass().remove(currentSizeStyleClass);
        }
        currentSizeStyleClass = safe(sizeStyleClass);
        if (!currentSizeStyleClass.isBlank()) {
            getStyleClass().add(currentSizeStyleClass);
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

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class FxAccess {

        private static void addStyle(Node node, String styleClass) {
            node.getStyleClass().add(styleClass);
        }

        private static void addChildren(Pane parent, Node... children) {
            parent.getChildren().addAll(children);
        }

        private static void bindWidth(Region target, Region host, double normalizedFraction) {
            target.prefWidthProperty().unbind();
            target.prefWidthProperty().bind(host.widthProperty().multiply(normalizedFraction));
        }
    }
}
