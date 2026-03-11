package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.editor.dialogs.EditDungeonMapDialog;
import features.world.dungeonmap.ui.editor.dialogs.NewDungeonMapDialog;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;

import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;

final class DungeonMapDialogs {

    void showNewMapDialog(Consumer<NewDungeonMapDialog.Result> onCreateRequested) {
        NewDungeonMapDialog dialog = new NewDungeonMapDialog();
        dialog.showAndWait().ifPresent(onCreateRequested);
    }

    void showEditMapDialog(
            DungeonMap map,
            DungeonMapState currentState,
            Consumer<EditDungeonMapDialog.Result> onUpdateRequested
    ) {
        EditDungeonMapDialog dialog = new EditDungeonMapDialog(map);
        dialog.showAndWait().ifPresent(result -> {
            if ((result.width() < map.width() || result.height() < map.height())
                    && !confirmShrink(map, currentState, result.width(), result.height())) {
                return;
            }
            onUpdateRequested.accept(result);
        });
    }

    private boolean confirmShrink(DungeonMap map, DungeonMapState currentState, int newWidth, int newHeight) {
        ResizeImpact impact = calculateResizeImpact(currentState, newWidth, newHeight);
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Dungeon von " + map.width() + "x" + map.height() + " auf "
                        + newWidth + "x" + newHeight + " verkleinern?\n"
                        + impact.squaresRemoved() + " Felder, "
                        + impact.endpointsRemoved() + " Übergänge und "
                        + impact.linksRemoved() + " Links werden unwiderruflich gelöscht.\n"
                        + "Falls die Gruppe auf einem entfernten Übergang steht, wird ihre Position zurückgesetzt.",
                ButtonType.CANCEL, ButtonType.OK);
        confirm.setHeaderText("Dungeonverkleinerung bestätigen");
        Button cancelButton = (Button) confirm.getDialogPane().lookupButton(ButtonType.CANCEL);
        cancelButton.setDefaultButton(true);
        Button okButton = (Button) confirm.getDialogPane().lookupButton(ButtonType.OK);
        okButton.setDefaultButton(false);
        return confirm.showAndWait().filter(ButtonType.OK::equals).isPresent();
    }

    private ResizeImpact calculateResizeImpact(DungeonMapState currentState, int newWidth, int newHeight) {
        if (currentState == null) {
            return new ResizeImpact(0, 0, 0);
        }
        Set<Long> removedSquareIds = new HashSet<>();
        for (DungeonSquare square : currentState.squares()) {
            if (square.x() >= newWidth || square.y() >= newHeight) {
                removedSquareIds.add(square.squareId());
            }
        }
        Set<Long> removedEndpointIds = new HashSet<>();
        for (DungeonEndpoint endpoint : currentState.endpoints()) {
            if (removedSquareIds.contains(endpoint.squareId())) {
                removedEndpointIds.add(endpoint.endpointId());
            }
        }
        int removedLinks = 0;
        for (var link : currentState.links()) {
            if (removedEndpointIds.contains(link.fromEndpointId()) || removedEndpointIds.contains(link.toEndpointId())) {
                removedLinks++;
            }
        }
        return new ResizeImpact(removedSquareIds.size(), removedEndpointIds.size(), removedLinks);
    }

    private record ResizeImpact(int squaresRemoved, int endpointsRemoved, int linksRemoved) {}
}
