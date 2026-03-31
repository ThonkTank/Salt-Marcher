package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.grid.DungeonGridInteractiveLabels;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

import java.util.ArrayList;
import java.util.List;

public final class DungeonLabelHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (layout == null || probe == null) {
            return List.of();
        }

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (RoomCluster cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            RoomCluster projected = cluster.projectedToLevel(probe.levelZ());
            if (projected == null) {
                continue;
            }
            InteractiveLabelHandle handle = projected.labelHandle();
            Point2D anchorPoint = DungeonGridInteractiveLabels.anchorPoint(
                    handle,
                    probe.panX(),
                    probe.panY(),
                    probe.gridSizePx());
            Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(
                    handle,
                    probe.panX(),
                    probe.panY(),
                    probe.gridSizePx());
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.ClusterLabelSubject(cluster.clusterId()),
                    List.of(new DungeonHitSurface.LabelSurface(bounds, anchorPoint, probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }
}
