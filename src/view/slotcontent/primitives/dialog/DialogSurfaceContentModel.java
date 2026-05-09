package src.view.slotcontent.primitives.dialog;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class DialogSurfaceContentModel {

    private final ReadOnlyObjectWrapper<LayoutState> layoutState =
            new ReadOnlyObjectWrapper<>(LayoutState.initial());

    public ReadOnlyObjectProperty<LayoutState> layoutStateProperty() {
        return layoutState.getReadOnlyProperty();
    }

    public LayoutState currentLayoutState() {
        return layoutState.get();
    }

    public void showLayout(BodyPolicy bodyPolicy, boolean headerVisible, boolean footerVisible) {
        layoutState.set(new LayoutState(
                bodyPolicy == null ? BodyPolicy.FIXED : bodyPolicy,
                headerVisible,
                footerVisible));
    }

    public enum BodyPolicy {
        FIXED,
        SCROLL;

        boolean usesScrollHost() {
            return this == SCROLL;
        }
    }

    public record LayoutState(
            BodyPolicy bodyPolicy,
            boolean headerVisible,
            boolean footerVisible
    ) {

        public LayoutState {
            bodyPolicy = bodyPolicy == null ? BodyPolicy.FIXED : bodyPolicy;
        }

        static LayoutState initial() {
            return new LayoutState(BodyPolicy.FIXED, false, false);
        }

        boolean showHeader(boolean headerHasContent) {
            return headerVisible && headerHasContent;
        }

        boolean showFooter(boolean footerHasContent) {
            return footerVisible && footerHasContent;
        }
    }
}
