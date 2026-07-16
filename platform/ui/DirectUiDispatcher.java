package platform.ui;

import java.util.Objects;

public enum DirectUiDispatcher implements UiDispatcher {
    INSTANCE;

    @Override
    public void dispatch(Runnable update) {
        Objects.requireNonNull(update, "update").run();
    }
}
