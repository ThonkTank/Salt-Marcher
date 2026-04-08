package features.world.api.input;

import javafx.scene.Node;

import java.util.List;
import java.util.function.Consumer;

public record TravelSurfaceInput(
        Node sceneContent,
        Runnable showOverworldTravelAction,
        Consumer<DungeonTravelPresentationInput> showDungeonTravelAction
) {

    public record DungeonTravelActionInput(String label, Runnable action) {
        public DungeonTravelActionInput {
            label = label == null || label.isBlank() ? "Aktion" : label.trim();
        }
    }

    public record DungeonTravelPresentationInput(
            String mapName,
            String areaLabel,
            String cellLabel,
            String headingLabel,
            String statusLabel,
            List<DungeonTravelActionInput> actions,
            Runnable centerAction
    ) {
        public DungeonTravelPresentationInput {
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

    public TravelSurfaceInput {
        showOverworldTravelAction = showOverworldTravelAction == null ? () -> { } : showOverworldTravelAction;
        showDungeonTravelAction = showDungeonTravelAction == null ? ignored -> { } : showDungeonTravelAction;
    }

    public void showOverworldTravel() {
        showOverworldTravelAction.run();
    }

    public void showDungeonTravel(DungeonTravelPresentationInput presentation) {
        showDungeonTravelAction.accept(presentation);
    }
}
