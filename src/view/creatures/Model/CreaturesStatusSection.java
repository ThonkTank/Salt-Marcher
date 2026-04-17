package src.view.creatures.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public final class CreaturesStatusSection {

    private final StringProperty statusText = new SimpleStringProperty("");
    private final BooleanProperty statusVisible = new SimpleBooleanProperty(false);
    private final BooleanProperty statusError = new SimpleBooleanProperty(false);

    public StringProperty statusTextProperty() {
        return statusText;
    }

    public BooleanProperty statusVisibleProperty() {
        return statusVisible;
    }

    public BooleanProperty statusErrorProperty() {
        return statusError;
    }

    public void show(String text, boolean error) {
        statusText.set(text == null ? "" : text);
        statusError.set(error);
        statusVisible.set(text != null && !text.isBlank());
    }

    public void clear() {
        statusText.set("");
        statusVisible.set(false);
        statusError.set(false);
    }
}
