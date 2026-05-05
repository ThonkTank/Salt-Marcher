package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class DungeonEditorIntentHandler {

    private Consumer<DungeonEditorPublishedEvent> publishedEventListener = ignored -> {};

    DungeonEditorIntentHandler() {
    }

    void onPublishedEventRequested(Consumer<DungeonEditorPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void consume(DungeonEditorMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        publish(DungeonEditorPublishedEvent.interpretMainView(new DungeonEditorPublishedEvent.MainViewInput(
                toMainViewSource(event.pointerPhaseKey(), event.levelDelta()),
                event.canvasX(),
                event.canvasY(),
                event.primaryButtonDown(),
                event.secondaryButtonDown(),
                event.hitRef(),
                event.levelDelta())));
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.mapSelectionChanged()) {
            publishIfMapSelected(event.mapIdValue(), DungeonEditorPublishedEvent::selectMap);
            return;
        }
        if (event.createMapRequested()) {
            publish(DungeonEditorPublishedEvent.createMap(event.mapName()));
            return;
        }
        if (event.renameMapRequested()) {
            publishIfMapSelected(
                    event.mapIdValue(),
                    mapId -> DungeonEditorPublishedEvent.renameMap(mapId, event.mapName()));
            return;
        }
        if (event.deleteMapRequested()) {
            publishIfMapSelected(event.mapIdValue(), DungeonEditorPublishedEvent::deleteMap);
            return;
        }
        if (event.viewModeChanged()) {
            publish(DungeonEditorPublishedEvent.setViewMode(toPublishedViewMode(event.viewMode())));
            return;
        }
        if (event.toolChanged()) {
            publish(DungeonEditorPublishedEvent.setTool(toPublishedTool(event.tool())));
            return;
        }
        if (event.projectionLevelShift() != 0) {
            publish(DungeonEditorPublishedEvent.shiftProjectionLevel(event.projectionLevelShift()));
            return;
        }
        if (event.overlayChanged()) {
            publish(DungeonEditorPublishedEvent.setOverlay(toOverlaySettings(event)));
        }
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        publish(DungeonEditorPublishedEvent.saveRoomNarration(new DungeonEditorPublishedEvent.RoomNarrationInput(
                event.roomId(),
                event.visualDescription(),
                event.exits().stream().map(DungeonEditorIntentHandler::toPublishedExit).toList())));
    }

    private void publishIfMapSelected(long mapId, java.util.function.LongFunction<DungeonEditorPublishedEvent> factory) {
        if (mapId > 0L) {
            publish(factory.apply(mapId));
        }
    }

    private void publish(DungeonEditorPublishedEvent event) {
        if (event == null) {
            return;
        }
        publishedEventListener.accept(event);
    }

    private static DungeonEditorPublishedEvent.RoomExitNarration toPublishedExit(
            DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot exit
    ) {
        DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot safeExit = exit == null
                ? new DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot("", 0, 0, 0, "", "")
                : exit;
        return new DungeonEditorPublishedEvent.RoomExitNarration(
                safeExit.label(),
                new DungeonEditorPublishedEvent.CellRef(safeExit.q(), safeExit.r(), safeExit.level()),
                safeExit.direction(),
                safeExit.description());
    }

    private static DungeonEditorPublishedEvent.OverlaySettings toOverlaySettings(
            DungeonEditorControlsViewInputEvent event
    ) {
        return new DungeonEditorPublishedEvent.OverlaySettings(
                event.overlayModeKey(),
                event.overlayRange(),
                event.overlayOpacity(),
                parseLevels(event.overlayLevelsText()));
    }

    private static DungeonEditorPublishedEvent.MainViewInput.Source toMainViewSource(
            String pointerPhaseKey,
            int levelDelta
    ) {
        if (levelDelta != 0) {
            return DungeonEditorPublishedEvent.MainViewInput.Source.LEVEL_SCROLLED;
        }
        return switch (pointerPhaseKey == null ? "MOVE" : pointerPhaseKey) {
            case "PRESS" -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_PRESSED;
            case "DRAG" -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_DRAGGED;
            case "RELEASE" -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_RELEASED;
            default -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_MOVED;
        };
    }

    private static DungeonEditorPublishedEvent.ViewMode toPublishedViewMode(
            DungeonEditorControlsViewInputEvent.ViewMode viewMode
    ) {
        return viewMode == DungeonEditorControlsViewInputEvent.ViewMode.GRAPH
                ? DungeonEditorPublishedEvent.ViewMode.GRAPH
                : DungeonEditorPublishedEvent.ViewMode.GRID;
    }

    private static DungeonEditorPublishedEvent.Tool toPublishedTool(
            DungeonEditorControlsViewInputEvent.Tool tool
    ) {
        return tool == null ? DungeonEditorPublishedEvent.Tool.SELECT : DungeonEditorPublishedEvent.Tool.valueOf(tool.name());
    }

    private static List<Integer> parseLevels(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return java.util.Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isBlank())
                    .map(Integer::parseInt)
                    .sorted()
                    .distinct()
                    .toList();
        } catch (NumberFormatException exception) {
            return List.of();
        }
    }
}
