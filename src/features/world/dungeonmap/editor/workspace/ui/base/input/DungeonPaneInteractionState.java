package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

public final class DungeonPaneInteractionState {
    private PointerInteraction pointerInteraction = IdleInteraction.INSTANCE;

    public DungeonPaneInteractionState() {
    }

    public PointerInteraction pointerInteraction() {
        return pointerInteraction;
    }

    public void setPointerInteraction(PointerInteraction pointerInteraction) {
        this.pointerInteraction = pointerInteraction == null ? IdleInteraction.INSTANCE : pointerInteraction;
    }

    public sealed interface PointerInteraction
            permits IdleInteraction, PanInteraction, SelectionInteraction, PaintInteraction, DragInteraction,
            GraphCreateInteraction, GraphDeleteInteraction {
    }

    public enum IdleInteraction implements PointerInteraction {
        INSTANCE
    }

    public static final class PanInteraction implements PointerInteraction {
    }

    public static final class SelectionInteraction implements PointerInteraction {
        private final Point2i anchorWorld;
        private Point2i endWorld;

        public SelectionInteraction(Point2i anchorWorld) {
            this.anchorWorld = anchorWorld;
            this.endWorld = anchorWorld;
        }

        public Point2i anchorWorld() {
            return anchorWorld;
        }

        public Point2i endWorld() {
            return endWorld;
        }

        public void setEndWorld(Point2i endWorld) {
            this.endWorld = endWorld;
        }
    }

    public static final class PaintInteraction implements PointerInteraction {
        private final Point2i startCell;
        private Point2i endCell;

        public PaintInteraction(Point2i startCell) {
            this.startCell = startCell;
            this.endCell = startCell;
        }

        public Point2i startCell() {
            return startCell;
        }

        public Point2i endCell() {
            return endCell;
        }

        public void setEndCell(Point2i endCell) {
            this.endCell = endCell;
        }
    }

    public record DragInteraction(
            DungeonRoomCluster cluster,
            Point2i originalCenter,
            double anchorWorldX,
            double anchorWorldY
    ) implements PointerInteraction {
    }

    public record GraphCreateInteraction(Point2i world) implements PointerInteraction {
    }

    public record GraphDeleteInteraction(DungeonRoomCluster cluster) implements PointerInteraction {
    }
}
