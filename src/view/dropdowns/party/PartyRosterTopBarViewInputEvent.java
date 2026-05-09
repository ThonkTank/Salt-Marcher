package src.view.dropdowns.party;

public record PartyRosterTopBarViewInputEvent(
        boolean createEditorRequested,
        boolean editEditorRequested,
        boolean addExistingRequested,
        long memberId,
        int xpDelta,
        boolean removeRequested,
        boolean shortRestRequested,
        boolean longRestRequested
) {

    public PartyRosterTopBarViewInputEvent {
        memberId = Math.max(0L, memberId);
    }
}
