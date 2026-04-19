package src.view.dungeonshared.ViewModel;
/**
 * Visible editor tool families for the dungeon control panel.
 */
public enum DungeonEditorTool {
    SELECT("Auswahl", "Selektion und Inspector sind verdrahtet."),
    ROOM("Raum", "Raumverschiebung ist verdrahtet; Paint/Delete bleibt Placeholder."),
    WALL("Wand", "Interne Wände sind als Andockstelle vorbereitet."),
    DOOR("Tür", "Tür-Platzierung und -Semantik bleiben als Andockstelle vorbereitet."),
    CORRIDOR("Korridor", "Korridor-Erweiterung und -Reroute bleiben als Andockstelle vorbereitet."),
    STAIR("Treppe", "Treppen-Platzierung bleibt als Andockstelle vorbereitet."),
    TRANSITION("Übergang", "Übergänge bleiben als Andockstelle vorbereitet.");
    private final String label;
    private final String summary;
    DungeonEditorTool(String label, String summary) {
        this.label = label;
        this.summary = summary;
    }
    public String label() {
        return label;
    }
    public String summary() {
        return summary;
    }
    public static DungeonEditorTool defaultTool() {
        return SELECT;
    }
    public boolean isRoom() {
        return this == ROOM;
    }
}
