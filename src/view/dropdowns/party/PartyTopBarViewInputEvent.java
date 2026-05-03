package src.view.dropdowns.party;

public record PartyTopBarViewInputEvent(
        Source source
) {

    public PartyTopBarViewInputEvent {
        source = source == null ? Source.POPUP_OPENED : source;
    }

    enum Source {
        POPUP_OPENED
    }
}
