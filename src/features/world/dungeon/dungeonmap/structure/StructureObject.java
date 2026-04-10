package features.world.dungeon.dungeonmap.structure;

import features.world.dungeon.dungeonmap.structure.input.EmptyInput;
import features.world.dungeon.dungeonmap.structure.input.FromPersistenceSnapshotInput;
import features.world.dungeon.dungeonmap.structure.input.FromSpecificationInput;
import features.world.dungeon.dungeonmap.structure.input.FromSurfaceLevelInput;
import features.world.dungeon.dungeonmap.structure.input.LoadBoundaryAtLevelInput;
import features.world.dungeon.dungeonmap.structure.input.LoadRoomTopologyInput;
import features.world.dungeon.dungeonmap.structure.input.LoadSurfaceAtLevelInput;
import features.world.dungeon.dungeonmap.structure.input.MutateInput;
import features.world.dungeon.dungeonmap.structure.input.ProjectToLevelInput;
import features.world.dungeon.dungeonmap.structure.input.WithRoomMetadataInput;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeon.dungeonmap.structure.model.surface.StructureSurface;

/**
 * Public root owner object for shared dungeon structure topology.
 */
@SuppressWarnings("unused")
public final class StructureObject {

    public Structure empty(EmptyInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return Structure.empty();
    }

    public Structure fromSpecification(FromSpecificationInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return Structure.fromSpecification(input.specification());
    }

    public Structure fromSurfaceLevel(FromSurfaceLevelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return Structure.fromSurfaceLevel(input.levelZ(), input.surfaceArea(), input.doors());
    }

    public Structure fromPersistenceSnapshot(FromPersistenceSnapshotInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return Structure.fromPersistenceSnapshot(input.snapshot());
    }

    public Structure withRoomMetadata(WithRoomMetadataInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Structure structure = input.structure();
        return structure == null ? Structure.empty() : structure.withRoomMetadata(input.mapId(), input.clusterId(), input.rooms());
    }

    public Structure projectToLevel(ProjectToLevelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Structure structure = input.structure();
        return structure == null ? Structure.empty() : structure.projectedToLevel(input.levelZ());
    }

    public Structure mutate(MutateInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Structure structure = input.structure();
        return structure == null ? Structure.empty() : structure.mutated(input.mutation());
    }

    public StructureBoundary loadBoundaryAtLevel(LoadBoundaryAtLevelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Structure structure = input.structure();
        return structure == null ? StructureBoundary.empty() : structure.boundaryAtLevel(input.levelZ());
    }

    public StructureSurface loadSurfaceAtLevel(LoadSurfaceAtLevelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Structure structure = input.structure();
        return structure == null ? StructureSurface.empty() : structure.surfaceAtLevel(input.levelZ());
    }

    public StructureRoomTopology loadRoomTopology(LoadRoomTopologyInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Structure structure = input.structure();
        return structure == null ? StructureRoomTopology.empty() : structure.roomTopology();
    }
}
