package src.view.slotcontent.state.encounter;

import java.util.List;
import javafx.scene.control.Button;
import javafx.scene.control.Tooltip;

public final class EncounterCombatPartyMemberButtonView extends Button {

    public static final String CONTROL_ID = "encounter-add-party-button";

    private final EncounterCombatPartyMemberPopupView popup = new EncounterCombatPartyMemberPopupView();
    private AddHandler onAdd = (id, initiative) -> { };
    private List<Candidate> candidates = List.of();

    public EncounterCombatPartyMemberButtonView() {
        super("SC hinzufuegen");
        getStyleClass().addAll("compact", "neutral-action");
        setId(CONTROL_ID);
        updateCandidates(List.of());
        setOnAction(event -> popup.show(this, candidates, onAdd));
    }

    public void updateCandidates(List<Candidate> value) {
        candidates = value == null ? List.of() : List.copyOf(value);
        setDisable(candidates.isEmpty());
        setTooltip(new Tooltip(candidates.isEmpty()
                ? "Alle aktiven SCs sind im Kampf."
                : "Aktives Party-Mitglied in den laufenden Kampf aufnehmen."));
    }

    public void updateAddHandler(AddHandler handler) {
        onAdd = handler == null ? (id, initiative) -> { } : handler;
    }

    public record Candidate(long memberId, String name, int level) {
    }

    @FunctionalInterface
    public interface AddHandler {
        void add(long memberId, int initiative);
    }
}
