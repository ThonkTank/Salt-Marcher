package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
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
    private CorridorDoorHandle selectedCorridorDoorHandle;
    private CorridorDoorHandle previewCorridorDoorHandle;
    private CorridorEditInteractionController.DoorDragPreview previewCorridorDoorDrag;

    public DungeonPreviewState() {
    }

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

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return selectedCorridorDoorHandle;
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle selectedCorridorDoorHandle) {
        this.selectedCorridorDoorHandle = selectedCorridorDoorHandle;
    }

    public CorridorDoorHandle previewCorridorDoorHandle() {
        return previewCorridorDoorHandle;
    }

    public void setPreviewCorridorDoorHandle(CorridorDoorHandle previewCorridorDoorHandle) {
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
