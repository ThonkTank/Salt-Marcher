package features.world.dungeonmap.service;

import features.world.dungeonmap.application.DungeonLinkCreateResult;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;

import java.util.List;

public final class DungeonMapCommands {

    public long createMap(String name, int width, int height) throws Exception {
        return DungeonMapEditorService.createMap(name, width, height);
    }

    public void updateMap(long mapId, String name, int width, int height) throws Exception {
        DungeonMapEditorService.updateMap(mapId, name, width, height);
    }

    public void deleteMap(long mapId) throws Exception {
        DungeonMapEditorService.deleteMap(mapId);
    }

    public void applySquareEditsAndReconcileState(long mapId, List<DungeonSquarePaint> edits) throws Exception {
        DungeonMapEditorService.applySquareEditsAndReconcileState(mapId, edits);
    }

    public void updateRoomMetadata(long roomId, String name, String description) throws Exception {
        DungeonMapEditorService.updateRoomMetadata(roomId, name, description);
    }

    public long saveArea(DungeonArea area) throws Exception {
        return DungeonMapEditorService.saveArea(area);
    }

    public void deleteArea(long areaId) throws Exception {
        DungeonMapEditorService.deleteArea(areaId);
    }

    public long saveFeature(DungeonFeature feature) throws Exception {
        return DungeonMapEditorService.saveFeature(feature);
    }

    public void deleteFeature(long featureId) throws Exception {
        DungeonMapEditorService.deleteFeature(featureId);
    }

    public void addSquareToFeature(long featureId, long squareId) throws Exception {
        DungeonMapEditorService.addSquareToFeature(featureId, squareId);
    }

    public void removeSquareFromFeature(long featureId, long squareId) throws Exception {
        DungeonMapEditorService.removeSquareFromFeature(featureId, squareId);
    }

    public void assignRoomArea(long roomId, long areaId) throws Exception {
        DungeonMapEditorService.assignRoomArea(roomId, areaId);
    }

    public long saveEndpoint(DungeonEndpoint endpoint) throws Exception {
        return DungeonMapEditorService.saveEndpoint(endpoint);
    }

    public void deleteEndpoint(long endpointId) throws Exception {
        DungeonMapEditorService.deleteEndpoint(endpointId);
    }

    public DungeonLinkCreateResult createLink(long mapId, DungeonLinkAnchor fromAnchor, DungeonLinkAnchor toAnchor, String label) throws Exception {
        return DungeonMapEditorService.createLink(mapId, fromAnchor, toAnchor, label);
    }

    public void deleteLink(long linkId) throws Exception {
        DungeonMapEditorService.deleteLink(linkId);
    }

    public void updateLinkLabel(long linkId, String label) throws Exception {
        DungeonMapEditorService.updateLinkLabel(linkId, label);
    }

    public long savePassage(DungeonPassage passage) throws Exception {
        return DungeonMapEditorService.savePassage(passage);
    }

    public void deletePassage(long passageId) throws Exception {
        DungeonMapEditorService.deletePassage(passageId);
    }

    public void applyWallEdits(long mapId, List<DungeonWallEdit> edits) throws Exception {
        DungeonMapEditorService.applyWallEdits(mapId, edits);
    }
}
