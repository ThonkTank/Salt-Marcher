package features.world.api.input;

public record WorldTravelSurface(
        javafx.scene.Node sceneContent,
        Runnable showOverworldTravelAction,
        java.util.function.Consumer<DungeonTravelPresentation> showDungeonTravelAction
) {

    public record DungeonTravelAction(String label, Runnable action) {
        public DungeonTravelAction {
            label = label == null || label.isBlank() ? "Aktion" : label.trim();
        }
    }

    public record DungeonTravelPresentation(
            String mapName,
            String areaLabel,
            String cellLabel,
            String headingLabel,
            String statusLabel,
            java.util.List<DungeonTravelAction> actions,
            Runnable centerAction
    ) {
        public DungeonTravelPresentation {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel;
            cellLabel = cellLabel == null || cellLabel.isBlank() ? "—" : cellLabel;
            headingLabel = headingLabel == null || headingLabel.isBlank() ? "—" : headingLabel;
            statusLabel = statusLabel == null || statusLabel.isBlank()
                    ? "Token im Dungeon auf ein begehbares Feld ziehen"
                    : statusLabel;
            actions = actions == null ? java.util.List.of() : java.util.List.copyOf(actions);
        }
    }

    public WorldTravelSurface {
        showOverworldTravelAction = showOverworldTravelAction == null ? () -> { } : showOverworldTravelAction;
        showDungeonTravelAction = showDungeonTravelAction == null ? ignored -> { } : showDungeonTravelAction;
    }

    public void showOverworldTravel() {
        showOverworldTravelAction.run();
    }

    public void showDungeonTravel(DungeonTravelPresentation presentation) {
        showDungeonTravelAction.accept(presentation);
    }
}
