package src.view.slotcontent.primitives.popup;

import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.StackPane;
import javafx.stage.Popup;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;

public final class AnchoredPopupView {

    private final Popup popup = new Popup();
    private final StackPane contentHost = new StackPane();
    private final Supplier<@Nullable Node> anchorSupplier;
    private final Supplier<@Nullable Node> focusTargetSupplier;
    private @Nullable Node focusReturn;

    private AnchoredPopupContentModel contentModel = new AnchoredPopupContentModel();
    private Consumer<AnchoredPopupViewInputEvent> viewInputEventHandler = ignored -> { };
    private javafx.beans.value.ChangeListener<AnchoredPopupContentModel.PopupState> popupStateListener;
    private long appliedFocusRequestId;

    public AnchoredPopupView(Node content, Supplier<@Nullable Node> anchorSupplier) {
        this(content, anchorSupplier, () -> null);
    }

    public AnchoredPopupView(
            Node content,
            Supplier<@Nullable Node> anchorSupplier,
            Supplier<@Nullable Node> focusTargetSupplier
    ) {
        this.anchorSupplier = anchorSupplier == null ? () -> null : anchorSupplier;
        this.focusTargetSupplier = focusTargetSupplier == null ? () -> null : focusTargetSupplier;
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        PopupFxAccess.installContent(popup, contentHost, content);
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                event.consume();
            }
        });
        popup.setOnHidden(event -> handleHidden());
        bind(contentModel);
    }

    public void bind(AnchoredPopupContentModel contentModel) {
        if (popupStateListener != null) {
            this.contentModel.popupStateProperty().removeListener(popupStateListener);
        }
        this.contentModel = contentModel == null ? new AnchoredPopupContentModel() : contentModel;
        popupStateListener = (ignored, before, after) -> applyPopupState(after);
        this.contentModel.popupStateProperty().addListener(popupStateListener);
        applyPopupState(this.contentModel.currentPopupState());
    }

    public void onViewInputEvent(Consumer<AnchoredPopupViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void applyPopupState(AnchoredPopupContentModel.PopupState popupState) {
        AnchoredPopupContentModel.PopupState safeState = popupState == null
                ? AnchoredPopupContentModel.PopupState.closed()
                : popupState;
        if (!safeState.open()) {
            hidePopupIfShowing();
            return;
        }
        Node anchor = anchorSupplier.get();
        if (!canShow(anchor)) {
            contentModel.popupHidden();
            return;
        }
        showPopup(anchor, safeState);
    }

    private void hidePopupIfShowing() {
        if (popup.isShowing()) {
            popup.hide();
        }
    }

    private void showPopup(Node anchor, AnchoredPopupContentModel.PopupState popupState) {
        focusReturn = anchor;
        prepareAnchor(anchor);
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds == null) {
            return;
        }
        AnchoredPopupContentModel.BoundsBounds popupBounds = new AnchoredPopupContentModel.BoundsBounds(
                bounds.getMinX(),
                bounds.getMaxX(),
                bounds.getMaxY());
        popup.show(anchor, popupState.popupX(popupBounds), popupState.popupY(popupBounds));
        requestFocusAfterShown(popupState);
        viewInputEventHandler.accept(new AnchoredPopupViewInputEvent(AnchoredPopupViewInputEvent.Interaction.SHOWN));
    }

    private static void prepareAnchor(Node anchor) {
        anchor.applyCss();
        if (anchor instanceof Parent parent) {
            parent.layout();
        }
    }

    private void requestFocusAfterShown(AnchoredPopupContentModel.PopupState popupState) {
        if (popupState.focusAfterShown() && popupState.focusRequestId() != appliedFocusRequestId) {
            Node focusTarget = focusTargetSupplier.get();
            if (focusTarget == null) {
                return;
            }
            appliedFocusRequestId = popupState.focusRequestId();
            Platform.runLater(focusTarget::requestFocus);
        }
    }

    private void handleHidden() {
        if (focusReturn != null) {
            focusReturn.requestFocus();
        }
        contentModel.popupHidden();
        viewInputEventHandler.accept(new AnchoredPopupViewInputEvent(AnchoredPopupViewInputEvent.Interaction.HIDDEN));
    }

    private static boolean canShow(Node anchor) {
        return anchor != null && anchor.getScene() != null;
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class PopupFxAccess {

        private static void installContent(Popup popup, StackPane contentHost, @Nullable Node content) {
            popup.getContent().setAll(contentHost);
            contentHost.getChildren().setAll(content == null ? java.util.List.of() : java.util.List.of(content));
        }
    }
}
