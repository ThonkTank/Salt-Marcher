package features.world.dungeonmap.service;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import features.world.dungeonmap.service.editing.connection.DungeonConnectionEditingService;
import features.world.dungeonmap.service.editing.connection.DungeonLinkCreateResult;
import features.world.dungeonmap.service.editing.feature.DungeonFeatureEditingService;
import features.world.dungeonmap.service.editing.map.DungeonMapLifecycleEditingService;
import features.world.dungeonmap.service.editing.topology.DungeonTopologyEditingService;

import java.util.List;

public final class DungeonMapCommandService {

    public long createMap(String name, int width, int height) throws Exception {
        return DungeonMapLifecycleEditingService.createMap(name, width, height);
    }

    public void updateMap(long mapId, String name, int width, int height) throws Exception {
        DungeonMapLifecycleEditingService.updateMap(mapId, name, width, height);
    }

    public void deleteMap(long mapId) throws Exception {
        DungeonMapLifecycleEditingService.deleteMap(mapId);
    }

    public void applySquareEditsAndReconcileState(long mapId, List<DungeonSquarePaint> edits) throws Exception {
        DungeonTopologyEditingService.applySquareEditsAndReconcileState(mapId, edits);
    }

    public void updateRoomMetadata(
            long roomId,
            String name,
            String lightLevel,
            String visualDescription,
            String soundsDescription,
            String smellsDescription,
            String otherDescription,
            String glanceDescription,
            String detailDescription,
            String reactiveChecks,
            String gmBackground
    ) throws Exception {
        DungeonFeatureEditingService.updateRoomMetadata(
                roomId,
                name,
                lightLevel,
                visualDescription,
                soundsDescription,
                smellsDescription,
                otherDescription,
                glanceDescription,
                detailDescription,
                reactiveChecks,
                gmBackground);
    }

    public long saveArea(DungeonArea area) throws Exception {
        return DungeonFeatureEditingService.saveArea(area);
    }

    public void deleteArea(long areaId) throws Exception {
        DungeonFeatureEditingService.deleteArea(areaId);
    }

    public long saveFeature(DungeonFeature feature) throws Exception {
        return DungeonFeatureEditingService.saveFeature(feature);
    }

    public Long applyFeatureEditsAndReconcileState(long mapId, DungeonFeatureCategory category, List<DungeonSquarePaint> edits) throws Exception {
        return DungeonFeatureEditingService.applyFeaturePaints(mapId, category, edits);
    }

    public void deleteFeature(long featureId) throws Exception {
        DungeonFeatureEditingService.deleteFeature(featureId);
    }

    public void addSquareToFeature(long featureId, long squareId) throws Exception {
        DungeonFeatureEditingService.addSquareToFeature(featureId, squareId);
    }

    public void removeSquareFromFeature(long featureId, long squareId) throws Exception {
        DungeonFeatureEditingService.removeSquareFromFeature(featureId, squareId);
    }

    public void assignRoomArea(long roomId, long areaId) throws Exception {
        DungeonFeatureEditingService.assignRoomArea(roomId, areaId);
    }

    public long saveEndpoint(DungeonEndpoint endpoint) throws Exception {
        return DungeonConnectionEditingService.saveEndpoint(endpoint);
    }

    public void deleteEndpoint(long endpointId) throws Exception {
        DungeonConnectionEditingService.deleteEndpoint(endpointId);
    }

    public DungeonLinkCreateResult createLink(long mapId, DungeonLinkAnchor fromAnchor, DungeonLinkAnchor toAnchor, String label) throws Exception {
        return DungeonConnectionEditingService.createLink(mapId, fromAnchor, toAnchor, label);
    }

    public void deleteLink(long linkId) throws Exception {
        DungeonConnectionEditingService.deleteLink(linkId);
    }

    public void updateLinkLabel(long linkId, String label) throws Exception {
        DungeonConnectionEditingService.updateLinkLabel(linkId, label);
    }

    public long savePassage(DungeonPassage passage) throws Exception {
        return DungeonConnectionEditingService.savePassage(passage);
    }

    public void deletePassage(long passageId) throws Exception {
        DungeonConnectionEditingService.deletePassage(passageId);
    }

    public void applyWallEdits(long mapId, List<DungeonWallEdit> edits) throws Exception {
        DungeonTopologyEditingService.applyWallEdits(mapId, edits);
    }
}
