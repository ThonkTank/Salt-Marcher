package features.world.dungeonmap.ui.workspace.workflow.state;

import features.world.dungeonmap.domain.model.Point2i;
import features.world.dungeonmap.ui.workspace.workflow.CorridorEditInteractionController;
import javafx.geometry.Point2D;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class DungeonPreviewState {
    private final Map<Long, Point2i> clusterCenters = new HashMap<>();
    private final Map<Long, Point2D> clusterOffsets = new HashMap<>();
    private final Set<Point2i> paintCells = new LinkedHashSet<>();
    private Long hoveredCorridorId;
    private CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle;
    private CorridorEditInteractionController.DoorHandle previewCorridorDoorHandle;
    private CorridorEditInteractionController.DoorDragPreview previewCorridorDoorDrag;

    public Map<Long, Point2i> clusterCenters() {
        return clusterCenters;
    }

    public Map<Long, Point2D> clusterOffsets() {
        return clusterOffsets;
    }

    public Set<Point2i> paintCells() {
        return paintCells;
    }

    public Long hoveredCorridorId() {
        return hoveredCorridorId;
    }

    public void setHoveredCorridorId(Long hoveredCorridorId) {
        this.hoveredCorridorId = hoveredCorridorId;
    }

    public CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle() {
        return selectedCorridorDoorHandle;
    }

    public void setSelectedCorridorDoorHandle(CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle) {
        this.selectedCorridorDoorHandle = selectedCorridorDoorHandle;
    }

    public CorridorEditInteractionController.DoorHandle previewCorridorDoorHandle() {
        return previewCorridorDoorHandle;
    }

    public void setPreviewCorridorDoorHandle(CorridorEditInteractionController.DoorHandle previewCorridorDoorHandle) {
        this.previewCorridorDoorHandle = previewCorridorDoorHandle;
    }

    public CorridorEditInteractionController.DoorDragPreview previewCorridorDoorDrag() {
        return previewCorridorDoorDrag;
    }

    public void setPreviewCorridorDoorDrag(CorridorEditInteractionController.DoorDragPreview previewCorridorDoorDrag) {
        this.previewCorridorDoorDrag = previewCorridorDoorDrag;
    }

    public void clearTransientPreview() {
        clusterCenters.clear();
        clusterOffsets.clear();
        paintCells.clear();
        previewCorridorDoorHandle = null;
        previewCorridorDoorDrag = null;
        hoveredCorridorId = null;
    }
}
