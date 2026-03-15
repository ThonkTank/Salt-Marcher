package features.world.dungeonmap.ui.editor.workflow.connection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConnectionPoint;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionController;
import ui.async.UiErrorReporter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public final class DungeonConnectionWorkflow {

    private final DungeonEditorState state;
    private final DungeonSelectionController selectionController;
    private final DungeonMapCommandService commands;
    private final Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap;

    public DungeonConnectionWorkflow(
            DungeonEditorState state,
            DungeonSelectionController selectionController,
            DungeonMapCommandService commands,
            Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap
    ) {
        this.state = state;
        this.selectionController = selectionController;
        this.commands = commands;
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    public void selectConnection(Long connectionId) {
        if (connectionId == null) {
            return;
        }
        DungeonConnection connection = state.findConnection(connectionId);
        if (connection != null) {
            selectionController.selectConnection(connection);
        }
    }

    public void moveConnectionPoint(DungeonMapPane.ConnectionPointMoveRequest request) {
        if (request == null || request.connectionId() == null) {
            return;
        }
        List<DungeonConnectionPoint> points = editablePoints(request.connectionId());
        if (request.pointIndex() < 0 || request.pointIndex() >= points.size()) {
            return;
        }
        DungeonConnectionPoint existing = points.get(request.pointIndex());
        if (existing.x() == request.x() && existing.y() == request.y()) {
            return;
        }
        points.set(request.pointIndex(), new DungeonConnectionPoint(
                null,
                request.connectionId(),
                request.pointIndex(),
                request.x(),
                request.y()));
        persistConnectionPoints(request.connectionId(), points);
    }

    public void insertConnectionPoint(DungeonMapPane.ConnectionPointInsertRequest request) {
        if (request == null || request.connectionId() == null) {
            return;
        }
        List<DungeonConnectionPoint> points = editablePoints(request.connectionId());
        int insertIndex = resolveInsertIndex(request.connectionId(), request.x(), request.y(), points);
        points.add(insertIndex, new DungeonConnectionPoint(null, request.connectionId(), insertIndex, request.x(), request.y()));
        persistConnectionPoints(request.connectionId(), points);
    }

    public void deleteConnectionPoint(DungeonMapPane.ConnectionPointDeleteRequest request) {
        if (request == null || request.connectionId() == null) {
            return;
        }
        List<DungeonConnectionPoint> points = editablePoints(request.connectionId());
        if (request.pointIndex() < 0 || request.pointIndex() >= points.size()) {
            return;
        }
        points.remove(request.pointIndex());
        persistConnectionPoints(request.connectionId(), points);
    }

    private void persistConnectionPoints(Long connectionId, List<DungeonConnectionPoint> points) {
        if (connectionId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> commands.replaceConnectionPoints(connectionId, points),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.connection(connectionId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.replaceConnectionPoints()", ex));
    }

    private List<DungeonConnectionPoint> editablePoints(Long connectionId) {
        List<DungeonConnectionPoint> result = new ArrayList<>();
        if (state.currentState() == null || connectionId == null) {
            return result;
        }
        for (DungeonConnectionPoint point : state.currentState().connectionPoints()) {
            if (connectionId.equals(point.connectionId())) {
                result.add(point);
            }
        }
        result.sort(java.util.Comparator.comparingInt(DungeonConnectionPoint::sortOrder));
        return result;
    }

    private int resolveInsertIndex(Long connectionId, int x, int y, List<DungeonConnectionPoint> points) {
        DungeonMapConnectionPath path = findConnectionPath(connectionId);
        if (path == null || points.isEmpty()) {
            return 0;
        }
        int nearestRouteIndex = 0;
        double bestDistance = Double.MAX_VALUE;
        for (int index = 0; index < path.routePoints().size(); index++) {
            DungeonMapConnectionPath.GridPoint routePoint = path.routePoints().get(index);
            double dx = (routePoint.x() - 0.5) - x;
            double dy = (routePoint.y() - 0.5) - y;
            double distance = dx * dx + dy * dy;
            if (distance < bestDistance) {
                bestDistance = distance;
                nearestRouteIndex = index;
            }
        }
        int insertIndex = 0;
        for (DungeonConnectionPoint point : points) {
            int routeIndex = routeIndexForPoint(path, point);
            if (routeIndex >= 0 && routeIndex < nearestRouteIndex) {
                insertIndex += 1;
            }
        }
        return Math.max(0, Math.min(points.size(), insertIndex));
    }

    private int routeIndexForPoint(DungeonMapConnectionPath path, DungeonConnectionPoint point) {
        for (int index = 0; index < path.routePoints().size(); index++) {
            DungeonMapConnectionPath.GridPoint routePoint = path.routePoints().get(index);
            if (Math.abs(routePoint.x() - (point.x() + 0.5)) < 0.001
                    && Math.abs(routePoint.y() - (point.y() + 0.5)) < 0.001) {
                return index;
            }
        }
        return -1;
    }

    private DungeonMapConnectionPath findConnectionPath(Long connectionId) {
        if (state.currentState() == null || connectionId == null) {
            return null;
        }
        for (DungeonMapConnectionPath connectionPath : state.currentState().roomConnections()) {
            if (connectionId.equals(connectionPath.connectionId())) {
                return connectionPath;
            }
        }
        return null;
    }
}
