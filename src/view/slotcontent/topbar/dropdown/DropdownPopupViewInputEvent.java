package src.view.slotcontent.topbar.dropdown;

public record DropdownPopupViewInputEvent(Interaction interaction) {

    public DropdownPopupViewInputEvent {
        interaction = interaction == null ? Interaction.REQUEST_CLOSE : interaction;
    }

    public enum Interaction {
        REQUEST_OPEN,
        REQUEST_CLOSE,
        HIDDEN
    }
}
