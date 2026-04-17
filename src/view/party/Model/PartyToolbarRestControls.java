package src.view.party.Model;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;

public final class PartyToolbarRestControls {

    private final BooleanProperty shortRestDisabled = new SimpleBooleanProperty(true);
    private final BooleanProperty longRestDisabled = new SimpleBooleanProperty(true);

    public BooleanProperty shortRestDisabledProperty() {
        return shortRestDisabled;
    }

    public BooleanProperty longRestDisabledProperty() {
        return longRestDisabled;
    }

    void apply(boolean noActiveParty) {
        shortRestDisabled.set(noActiveParty);
        longRestDisabled.set(noActiveParty);
    }
}
