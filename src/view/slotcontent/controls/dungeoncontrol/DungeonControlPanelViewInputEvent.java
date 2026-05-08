package src.view.slotcontent.controls.dungeoncontrol;

public record DungeonControlPanelViewInputEvent(
        OverlayInput overlay
) {

    public record OverlayInput(
            String modeKey,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        public OverlayInput {
            modeKey = modeKey == null ? "" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }
    }
}
