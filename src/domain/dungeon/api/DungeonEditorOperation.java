package src.domain.dungeon.api;

import src.domain.dungeon.valueobject.BoundarySidePlacement;
import src.domain.dungeon.valueobject.ConnectionId;
import src.domain.dungeon.valueobject.CorridorSegmentId;
import src.domain.dungeon.valueobject.EdgeAnchor;
import src.domain.dungeon.valueobject.FeatureId;
import src.domain.dungeon.valueobject.LabelAnchor;
import src.domain.dungeon.valueobject.MapPlacement;
import src.domain.dungeon.valueobject.SpaceId;
import src.domain.dungeon.valueobject.SpaceKind;
import src.domain.dungeon.valueobject.StairPlacement;
import src.domain.dungeon.valueobject.TraversabilityState;
import src.domain.dungeon.valueobject.VertexPolyline;
import src.domain.dungeon.valueobject.VertexRect;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.CreateMap,
        DungeonEditorOperation.PaintArea,
        DungeonEditorOperation.EraseArea,
        DungeonEditorOperation.PaintFloorOpening,
        DungeonEditorOperation.EraseFloorOpening,
        DungeonEditorOperation.DrawInternalWall,
        DungeonEditorOperation.EraseInternalWall,
        DungeonEditorOperation.PlaceDoor,
        DungeonEditorOperation.UpdateDoor,
        DungeonEditorOperation.RemoveDoor,
        DungeonEditorOperation.PlaceStair,
        DungeonEditorOperation.UpdateStair,
        DungeonEditorOperation.RemoveConnection,
        DungeonEditorOperation.ExtendCorridor,
        DungeonEditorOperation.RerouteCorridor,
        DungeonEditorOperation.UpdateSpaceMetadata,
        DungeonEditorOperation.UpdateConnectionMetadata,
        DungeonEditorOperation.AddFeature,
        DungeonEditorOperation.UpdateFeature,
        DungeonEditorOperation.RemoveFeature,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.ResetDemoLayout {

    record CreateMap(String mapName) implements DungeonEditorOperation {
    }

    record PaintArea(VertexRect selection) implements DungeonEditorOperation {
    }

    record EraseArea(VertexRect selection) implements DungeonEditorOperation {
    }

    record PaintFloorOpening(VertexRect selection) implements DungeonEditorOperation {
    }

    record EraseFloorOpening(VertexRect selection) implements DungeonEditorOperation {
    }

    record DrawInternalWall(VertexPolyline path) implements DungeonEditorOperation {
    }

    record EraseInternalWall(VertexPolyline path) implements DungeonEditorOperation {
    }

    /**
     * Creates a semantic door connection plus its authored spatial anchor.
     */
    record PlaceDoor(EdgeAnchor anchor) implements DungeonEditorOperation {
    }

    /**
     * Repositions only the authored door anchor in SpatialTopology.
     * Semantic connection edits belong in UpdateConnectionMetadata.
     */
    record UpdateDoor(ConnectionId connectionId, EdgeAnchor anchor) implements DungeonEditorOperation {
    }

    record RemoveDoor(ConnectionId connectionId) implements DungeonEditorOperation {
    }

    /**
     * Creates a semantic stair connection plus its full authored spatial placement.
     */
    record PlaceStair(ConnectionId connectionId, StairPlacement placement) implements DungeonEditorOperation {
    }

    /**
     * Repositions or reshapes only the authored stair placement in SpatialTopology.
     */
    record UpdateStair(ConnectionId connectionId, StairPlacement placement) implements DungeonEditorOperation {
    }

    record RemoveConnection(ConnectionId connectionId) implements DungeonEditorOperation {
    }

    record ExtendCorridor(MapPlacement from, MapPlacement to) implements DungeonEditorOperation {
        public ExtendCorridor {
            if (!(from instanceof src.domain.dungeon.valueobject.DoorSidePlacement
                    || from instanceof BoundarySidePlacement)) {
                throw new IllegalArgumentException("corridor start must be a door side or boundary side placement");
            }
            if (!(to instanceof src.domain.dungeon.valueobject.DoorSidePlacement
                    || to instanceof BoundarySidePlacement)) {
                throw new IllegalArgumentException("corridor end must be a door side or boundary side placement");
            }
        }
    }

    record RerouteCorridor(CorridorSegmentId segmentId) implements DungeonEditorOperation {
    }

    record UpdateSpaceMetadata(SpaceId spaceId, SpaceKind spaceKind, LabelAnchor labelAnchor, String narrativeSummary) implements DungeonEditorOperation {
    }

    /**
     * Updates semantic connection metadata only and must not mutate authored placement truth.
     */
    record UpdateConnectionMetadata(ConnectionId connectionId, TraversabilityState traversabilityState, String authoredNote) implements DungeonEditorOperation {
    }

    record AddFeature(FeatureId featureId, MapPlacement placement, String featureKind) implements DungeonEditorOperation {
    }

    record UpdateFeature(FeatureId featureId, MapPlacement placement, String featureKind, String gmNotes) implements DungeonEditorOperation {
    }

    record RemoveFeature(FeatureId featureId) implements DungeonEditorOperation {
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record ResetDemoLayout() implements DungeonEditorOperation {
    }
}
