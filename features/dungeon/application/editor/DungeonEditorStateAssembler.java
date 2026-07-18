package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorControlsSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.editor.DungeonEditorDraftState;
import features.dungeon.api.editor.DungeonEditorState;

/** Assembles the single public editor publication directly from owner readbacks. */
final class DungeonEditorStateAssembler {

    DungeonEditorState assemble(
            long publicationRevision,
            long requestGeneration,
            DungeonEditorControlsSnapshot controls,
            DungeonEditorMapSurfaceSnapshot mapSurface,
            DungeonEditorStateSnapshot state,
            DungeonEditorRuntimeDraftFrame drafts
    ) {
        DungeonEditorControlsSnapshot safeControls = controls == null
                ? DungeonEditorControlsSnapshot.empty("")
                : controls;
        DungeonEditorMapSurfaceSnapshot safeMapSurface = mapSurface == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : mapSurface;
        DungeonEditorStateSnapshot safeState = state == null
                ? DungeonEditorStateSnapshot.empty("")
                : state;
        DungeonEditorRuntimeDraftFrame safeDrafts = drafts == null
                ? new DungeonEditorRuntimeDraftFrame(null, null, null, null, null, null, null)
                : drafts;
        return new DungeonEditorState(
                publicationRevision,
                requestGeneration,
                safeControls.maps(),
                safeControls.selectedMapId(),
                safeMapSurface.surface(),
                safeControls.viewMode(),
                safeControls.toolSelection(),
                safeControls.overlaySettings(),
                safeControls.projectionLevel(),
                safeControls.reachableLevels(),
                safeMapSurface.selection(),
                draftFrom(safeDrafts),
                safeMapSurface.preview(),
                safeState.inspector(),
                new DungeonEditorState.CommandStatus(
                        false,
                        safeControls.commandOutcome(),
                        statusText(safeControls)));
    }

    private static String statusText(DungeonEditorControlsSnapshot controls) {
        if (controls.surfaceLoaded()) {
            return controls.statusText();
        }
        if (controls.maps().isEmpty()) {
            return "Keine Dungeon-Maps vorhanden.";
        }
        if (controls.selectedMapId() == null) {
            return "Kein Dungeon ausgewählt.";
        }
        return controls.statusText();
    }

    private static DungeonEditorDraftState draftFrom(DungeonEditorRuntimeDraftFrame drafts) {
        var label = drafts.labelNameDraft();
        var labelTarget = label.target();
        var corridor = drafts.corridorPointDraft();
        var transitionDescription = drafts.transitionDescriptionDraft();
        var transitionDestination = drafts.transitionDestinationDraft();
        var stair = drafts.stairGeometryDraft();
        var inlineLabel = drafts.inlineLabelEditSession();
        return new DungeonEditorDraftState(
                drafts.roomNarrationDrafts().rooms().stream()
                        .map(room -> new DungeonEditorDraftState.RoomNarrationDraft(
                                room.roomId(),
                                room.visualPresent(),
                                room.visualDescription(),
                                room.exits().stream()
                                        .map(exit -> new DungeonEditorDraftState.ExitNarrationDraft(
                                                exit.label(), exit.q(), exit.r(), exit.level(),
                                                exit.direction(), exit.description(), exit.present()))
                                        .toList()))
                        .toList(),
                new DungeonEditorDraftState.LabelNameDraft(
                        labelTarget.kind().name(), labelTarget.targetId(), label.label(),
                        label.fallbackName(), label.name(), label.present()),
                new DungeonEditorDraftState.CorridorPointDraft(
                        corridor.targetPresent(), corridor.present(), corridor.label(),
                        corridor.q(), corridor.r(), corridor.level()),
                new DungeonEditorDraftState.TransitionDescriptionDraft(
                        transitionDescription.transitionId(), transitionDescription.description(),
                        transitionDescription.present()),
                new DungeonEditorDraftState.TransitionDestinationDraft(
                        transitionDestination.targetPresent(), transitionDestination.sourceTransitionId(),
                        transitionDestination.destinationTypeKey(), transitionDestination.mapId(),
                        transitionDestination.tileId(), transitionDestination.transitionId(),
                        transitionDestination.bidirectional(), transitionDestination.present()),
                new DungeonEditorDraftState.StairGeometryDraft(
                        stair.targetPresent(), stair.stairId(), stair.shapeName(), stair.directionName(),
                        stair.dimension1(), stair.dimension2(), stair.present()),
                new DungeonEditorDraftState.InlineLabelDraft(
                        inlineLabel.active(), inlineLabel.target().kind().name(),
                        inlineLabel.target().targetId(), inlineLabel.labelKind(), inlineLabel.ownerId(),
                        inlineLabel.clusterId(), inlineLabel.topologyKind(), inlineLabel.topologyId(),
                        inlineLabel.draftText()));
    }
}
