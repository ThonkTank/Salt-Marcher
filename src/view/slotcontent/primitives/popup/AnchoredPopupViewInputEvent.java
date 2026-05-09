package src.view.slotcontent.primitives.popup;

public record AnchoredPopupViewInputEvent(Interaction interaction) {

    public AnchoredPopupViewInputEvent {
        interaction = interaction == null ? Interaction.HIDDEN : interaction;
    }

    public enum Interaction {
        SHOWN,
        HIDDEN;

        public boolean isHidden() {
            return this == HIDDEN;
        }
    }
}
