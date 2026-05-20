package src.view.dropdowns.party;

import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

public final class PartyTopBarContentModel {

    private final ReadOnlyStringWrapper headerTitle = new ReadOnlyStringWrapper("PARTY");
    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Keine _Party ▼");

    public ReadOnlyStringProperty headerTitleProperty() {
        return headerTitle.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    void showTriggerText(String text) {
        triggerText.set(safe(text));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
