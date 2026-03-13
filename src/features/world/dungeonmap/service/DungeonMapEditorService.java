package features.world.dungeonmap.service;

import features.world.dungeonmap.application.DungeonLinkCreateResult;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.service.editing.DungeonConnectionEditingService;
import features.world.dungeonmap.service.editing.DungeonFeatureEditingService;
import features.world.dungeonmap.service.editing.DungeonMapLifecycleEditingService;
import features.world.dungeonmap.service.editing.DungeonTopologyEditingService;

import java.util.List;

public final class DungeonMapEditorService {

    private DungeonMapEditorService() {
        throw new AssertionError("No instances");
    }

    public static long createMap(String name, int width, int height) throws Exception {
        return DungeonMapLifecycleEditingService.createMap(name, width, height);
    }

    public static void updateMap(long mapId, String name, int width, int height) throws Exception {
        DungeonMapLifecycleEditingService.updateMap(mapId, name, width, height);
    }

    public static void deleteMap(long mapId) throws Exception {
        DungeonMapLifecycleEditingService.deleteMap(mapId);
    }

    public static void applySquareEditsAndReconcileState(long mapId, List<DungeonSquarePaint> edits) throws Exception {
        DungeonTopologyEditingService.applySquareEditsAndReconcileState(mapId, edits);
    }

    public static void updateRoomMetadata(long roomId, String name, String description) throws Exception {
        DungeonFeatureEditingService.updateRoomMetadata(roomId, name, description);
    }

    public static long saveArea(DungeonArea area) throws Exception {
        return DungeonFeatureEditingService.saveArea(area);
    }

    public static void deleteArea(long areaId) throws Exception {
        DungeonFeatureEditingService.deleteArea(areaId);
    }

    public static long saveFeature(DungeonFeature feature) throws Exception {
        return DungeonFeatureEditingService.saveFeature(feature);
    }

    public static void deleteFeature(long featureId) throws Exception {
        DungeonFeatureEditingService.deleteFeature(featureId);
    }

    public static void addSquareToFeature(long featureId, long squareId) throws Exception {
        DungeonFeatureEditingService.addSquareToFeature(featureId, squareId);
    }

    public static void removeSquareFromFeature(long featureId, long squareId) throws Exception {
        DungeonFeatureEditingService.removeSquareFromFeature(featureId, squareId);
    }

    public static void assignRoomArea(long roomId, long areaId) throws Exception {
        DungeonFeatureEditingService.assignRoomArea(roomId, areaId);
    }

    public static long saveEndpoint(DungeonEndpoint endpoint) throws Exception {
        return DungeonConnectionEditingService.saveEndpoint(endpoint);
    }

    public static void deleteEndpoint(long endpointId) throws Exception {
        DungeonConnectionEditingService.deleteEndpoint(endpointId);
    }

    public static DungeonLinkCreateResult createLink(long mapId, DungeonLinkAnchor fromAnchor, DungeonLinkAnchor toAnchor, String label) throws Exception {
        return DungeonConnectionEditingService.createLink(mapId, fromAnchor, toAnchor, label);
    }

    public static void deleteLink(long linkId) throws Exception {
        DungeonConnectionEditingService.deleteLink(linkId);
    }

    public static void updateLinkLabel(long linkId, String label) throws Exception {
        DungeonConnectionEditingService.updateLinkLabel(linkId, label);
    }

    public static long savePassage(DungeonPassage passage) throws Exception {
        return DungeonConnectionEditingService.savePassage(passage);
    }

    public static void deletePassage(long passageId) throws Exception {
        DungeonConnectionEditingService.deletePassage(passageId);
    }

    public static void applyWallEdits(long mapId, List<DungeonWallEdit> edits) throws Exception {
        DungeonTopologyEditingService.applyWallEdits(mapId, edits);
    }
}
