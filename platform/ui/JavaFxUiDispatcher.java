package platform.ui;

import java.util.Objects;
import javafx.application.Platform;

public final class JavaFxUiDispatcher implements UiDispatcher {

    @Override
    public void dispatch(Runnable update) {
        Runnable safeUpdate = Objects.requireNonNull(update, "update");
        if (Platform.isFxApplicationThread()) {
            safeUpdate.run();
        } else {
            Platform.runLater(safeUpdate);
        }
    }
}
