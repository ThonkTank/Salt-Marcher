package src.view.topbar.party;

import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import src.domain.party.PartyApplicationService;

public final class PartyTopBarViewModel {

    private final PartyApplicationService party;
    private final StringProperty summary = new SimpleStringProperty("");

    public PartyTopBarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public ReadOnlyStringProperty summaryProperty() {
        return summary;
    }

    public void refresh() {
        summary.set(String.valueOf(party.loadSnapshot()));
    }
}
