package src.view.slotcontent.primitives.popup;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class AnchoredPopupContentModel {

    private final ReadOnlyObjectWrapper<PopupState> popupState =
            new ReadOnlyObjectWrapper<>(PopupState.closed());
    private long focusRequestSequence;

    public ReadOnlyObjectProperty<PopupState> popupStateProperty() {
        return popupState.getReadOnlyProperty();
    }

    public PopupState currentPopupState() {
        return popupState.get();
    }

    public boolean isOpen() {
        return popupState.get().open();
    }

    public void showBelow() {
        showBelow(2.0, false);
    }

    public void showBelow(double yOffset) {
        showBelow(yOffset, false);
    }

    public void showBelow(double yOffset, boolean focusAfterShown) {
        popupState.set(new PopupState(true, Placement.BELOW, yOffset, 0.0, focusRequestId(focusAfterShown), focusAfterShown));
    }

    public void toggleBelow(double yOffset, boolean focusAfterShown) {
        if (isOpen()) {
            hide();
            return;
        }
        showBelow(yOffset, focusAfterShown);
    }

    public void showTrailing(double popupWidth) {
        showTrailing(popupWidth, false);
    }

    public void showTrailing(double popupWidth, boolean focusAfterShown) {
        popupState.set(new PopupState(
                true,
                Placement.TRAILING,
                2.0,
                Math.max(0.0, popupWidth),
                focusRequestId(focusAfterShown),
                focusAfterShown));
    }

    public void toggleTrailing(double popupWidth, boolean focusAfterShown) {
        if (isOpen()) {
            hide();
            return;
        }
        showTrailing(popupWidth, focusAfterShown);
    }

    public void hide() {
        popupState.set(popupState.get().asClosed());
    }

    public void popupHidden() {
        if (popupState.get().open()) {
            popupState.set(popupState.get().asClosed());
        }
    }

    private long focusRequestId(boolean focusAfterShown) {
        if (!focusAfterShown) {
            return focusRequestSequence;
        }
        focusRequestSequence++;
        return focusRequestSequence;
    }

    public enum Placement {
        BELOW,
        TRAILING
    }

    public record PopupState(
            boolean open,
            Placement placement,
            double yOffset,
            double popupWidth,
            long focusRequestId,
            boolean focusAfterShown
    ) {

        public PopupState {
            placement = placement == null ? Placement.BELOW : placement;
            yOffset = Math.max(0.0, yOffset);
            popupWidth = Math.max(0.0, popupWidth);
        }

        static PopupState closed() {
            return new PopupState(false, Placement.BELOW, 2.0, 0.0, 0L, false);
        }

        private PopupState asClosed() {
            return new PopupState(false, placement, yOffset, popupWidth, focusRequestId, false);
        }

        public double popupX(BoundsBounds bounds) {
            return placement == Placement.TRAILING
                    ? bounds.maxX() - popupWidth
                    : bounds.minX();
        }

        public double popupY(BoundsBounds bounds) {
            return bounds.maxY() + yOffset;
        }
    }

    public record BoundsBounds(
            double minX,
            double maxX,
            double maxY
    ) {
    }
}
