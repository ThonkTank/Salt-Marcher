package src.view.statetabs.encounter;

import java.util.List;
import java.util.function.Consumer;
import javafx.scene.control.Button;
import javafx.scene.control.Tooltip;

public final class EncounterCombatPartyMemberButtonStateView extends Button {

    public static final String CONTROL_ID = "encounter-add-party-button";

    private final EncounterCombatPartyMemberPopupStateView popup = new EncounterCombatPartyMemberPopupStateView();
    private List<Candidate> candidates = List.of();
    private Consumer<EncounterCombatPartyMemberButtonStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterCombatPartyMemberButtonStateView() {
        super("SC hinzufuegen");
        getStyleClass().addAll("compact", "neutral-action");
        setId(CONTROL_ID);
        updateCandidates(List.of());
        popup.onViewInputEvent(event -> viewInputEventHandler.accept(
                new EncounterCombatPartyMemberButtonStateViewInputEvent(event.memberId(), event.initiative())));
        setOnAction(event -> popup.show(this, candidates));
    }

    public void updateCandidates(List<Candidate> value) {
        candidates = value == null ? List.of() : List.copyOf(value);
        setDisable(candidates.isEmpty());
        setTooltip(new Tooltip(candidates.isEmpty()
                ? "Alle aktiven SCs sind im Kampf."
                : "Aktives Party-Mitglied in den laufenden Kampf aufnehmen."));
    }

    public void onViewInputEvent(Consumer<EncounterCombatPartyMemberButtonStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public record Candidate(long memberId, String name, int level) {
    }

}
