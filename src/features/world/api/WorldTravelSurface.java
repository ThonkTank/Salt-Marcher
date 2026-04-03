package features.world.api;

import javafx.scene.Node;

import java.util.List;

public interface WorldTravelSurface {

    record DungeonTravelAction(String label, Runnable action) {
        public DungeonTravelAction {
            label = label == null || label.isBlank() ? "Aktion" : label.trim();
        }
    }

    record DungeonTravelPresentation(
            String mapName,
            String areaLabel,
            String cellLabel,
            String headingLabel,
            String statusLabel,
            List<DungeonTravelAction> actions,
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
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    default Node sceneContent() {
        return null;
    }

    void showOverworldTravel();

    void showDungeonTravel(DungeonTravelPresentation presentation);
}
