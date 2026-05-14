package src.view.slotcontent.topbar.dropdown;

public record DropdownPopupViewInputEvent(Interaction interaction) {

    public DropdownPopupViewInputEvent {
        interaction = interaction == null ? Interaction.REQUEST_CLOSE : interaction;
    }

    public static DropdownPopupViewInputEvent requestOpen() {
        return new DropdownPopupViewInputEvent(Interaction.REQUEST_OPEN);
    }

    public static DropdownPopupViewInputEvent requestClose() {
        return new DropdownPopupViewInputEvent(Interaction.REQUEST_CLOSE);
    }

    public static DropdownPopupViewInputEvent hidden() {
        return new DropdownPopupViewInputEvent(Interaction.HIDDEN);
    }

    public boolean requestsOpen() {
        return interaction == Interaction.REQUEST_OPEN;
    }

    public boolean requestsClose() {
        return interaction == Interaction.REQUEST_CLOSE;
    }

    public boolean isHidden() {
        return interaction == Interaction.HIDDEN;
    }

    public enum Interaction {
        REQUEST_OPEN,
        REQUEST_CLOSE,
        HIDDEN
    }
}
