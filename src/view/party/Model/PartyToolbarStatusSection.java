package src.view.party.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public final class PartyToolbarStatusSection {

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

    void show(String text, boolean error) {
        statusText.set(text == null ? "" : text);
        statusError.set(error);
        statusVisible.set(text != null && !text.isBlank());
    }

    void clear() {
        statusText.set("");
        statusVisible.set(false);
        statusError.set(false);
    }
}
