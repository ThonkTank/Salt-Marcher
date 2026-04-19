package src.view.topbar.party;

import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.party.PartyApplicationService;

public final class PartyTopBarViewModel {

    private final PartyApplicationService party;
    private final ReadOnlyStringWrapper summary = new ReadOnlyStringWrapper("");

    public PartyTopBarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public ReadOnlyStringProperty summaryProperty() {
        return summary.getReadOnlyProperty();
    }

    public void refresh() {
        summary.set(String.valueOf(party.loadSnapshot()));
    }
}
