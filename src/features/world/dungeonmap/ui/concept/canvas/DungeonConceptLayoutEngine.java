package features.world.dungeonmap.ui.concept.canvas;

import javafx.animation.AnimationTimer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;

final class DungeonConceptLayoutEngine {

    private static final double NODE_MARGIN = 36;
    private static final double REPULSION = 26_000;
    private static final double SPRING_STRENGTH = 3.8;
    private static final double SPRING_LENGTH = 115;
    private static final double CENTER_FORCE = 0.75;
    private static final double DAMPING = 0.86;

    private final Supplier<List<DungeonConceptNodeVisual>> nodesSupplier;
    private final Supplier<List<DungeonConceptEdgeVisual>> edgesSupplier;
    private final DoubleSupplier widthSupplier;
    private final DoubleSupplier heightSupplier;
    private final Runnable geometryUpdater;
    private final Consumer<Boolean> settleHandler;
    private final AnimationTimer animationTimer;

    private long simulationUntilNanos;
    private long lastFrameNanos;
    private boolean persistOnSettle;

    DungeonConceptLayoutEngine(
            Supplier<List<DungeonConceptNodeVisual>> nodesSupplier,
            Supplier<List<DungeonConceptEdgeVisual>> edgesSupplier,
            DoubleSupplier widthSupplier,
            DoubleSupplier heightSupplier,
            Runnable geometryUpdater,
            Consumer<Boolean> settleHandler
    ) {
        this.nodesSupplier = nodesSupplier;
        this.edgesSupplier = edgesSupplier;
        this.widthSupplier = widthSupplier;
        this.heightSupplier = heightSupplier;
        this.geometryUpdater = geometryUpdater;
        this.settleHandler = settleHandler;
        this.animationTimer = new AnimationTimer() {
            @Override
            public void handle(long now) {
                tick(now);
            }
        };
        this.animationTimer.start();
    }

    void reset() {
        simulationUntilNanos = 0L;
        lastFrameNanos = 0L;
        persistOnSettle = false;
    }

    void start(double durationMillis, boolean persistOnSettle) {
        simulationUntilNanos = System.nanoTime() + (long) (durationMillis * 1_000_000L);
        this.persistOnSettle = this.persistOnSettle || persistOnSettle;
    }

    static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private void tick(long now) {
        List<DungeonConceptNodeVisual> visuals = nodesSupplier.get();
        if (visuals.isEmpty()) {
            lastFrameNanos = now;
            return;
        }
        if (lastFrameNanos == 0L) {
            lastFrameNanos = now;
            return;
        }
        if (now > simulationUntilNanos) {
            boolean shouldPersist = persistOnSettle;
            persistOnSettle = false;
            lastFrameNanos = now;
            settleHandler.accept(shouldPersist);
            return;
        }
        double dt = Math.min((now - lastFrameNanos) / 1_000_000_000.0, 0.033);
        lastFrameNanos = now;
        double energy = simulateStep(visuals, edgesSupplier.get(), widthSupplier.getAsDouble(), heightSupplier.getAsDouble(), dt);
        geometryUpdater.run();
        if (energy < 4.5) {
            simulationUntilNanos = 0L;
        }
    }

    private static double simulateStep(
            List<DungeonConceptNodeVisual> visuals,
            List<DungeonConceptEdgeVisual> edges,
            double width,
            double height,
            double dt
    ) {
        if (width <= 0 || height <= 0) {
            return 0.0;
        }
        Map<DungeonConceptNodeVisual, Integer> indexes = new LinkedHashMap<>();
        for (int index = 0; index < visuals.size(); index++) {
            indexes.put(visuals.get(index), index);
        }
        double[] fx = new double[visuals.size()];
        double[] fy = new double[visuals.size()];
        double centerX = width / 2.0;
        double centerY = height / 2.0;

        for (int leftIndex = 0; leftIndex < visuals.size(); leftIndex++) {
            DungeonConceptNodeVisual left = visuals.get(leftIndex);
            fx[leftIndex] += (centerX - left.x()) * CENTER_FORCE;
            fy[leftIndex] += (centerY - left.y()) * CENTER_FORCE;
            for (int rightIndex = leftIndex + 1; rightIndex < visuals.size(); rightIndex++) {
                DungeonConceptNodeVisual right = visuals.get(rightIndex);
                double dx = right.x() - left.x();
                double dy = right.y() - left.y();
                double distanceSquared = Math.max(dx * dx + dy * dy, 36);
                double distance = Math.sqrt(distanceSquared);
                double force = REPULSION / distanceSquared;
                double nx = dx / distance;
                double ny = dy / distance;
                fx[leftIndex] -= nx * force;
                fy[leftIndex] -= ny * force;
                fx[rightIndex] += nx * force;
                fy[rightIndex] += ny * force;
            }
        }

        for (DungeonConceptEdgeVisual edge : edges == null ? List.<DungeonConceptEdgeVisual>of() : edges) {
            Integer fromIndex = indexes.get(edge.from());
            Integer toIndex = indexes.get(edge.to());
            if (fromIndex == null || toIndex == null) {
                continue;
            }
            double dx = edge.to().x() - edge.from().x();
            double dy = edge.to().y() - edge.from().y();
            double distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            double springForce = (distance - SPRING_LENGTH) * SPRING_STRENGTH;
            double nx = dx / distance;
            double ny = dy / distance;
            fx[fromIndex] += nx * springForce;
            fy[fromIndex] += ny * springForce;
            fx[toIndex] -= nx * springForce;
            fy[toIndex] -= ny * springForce;
        }

        double energy = 0.0;
        for (int index = 0; index < visuals.size(); index++) {
            DungeonConceptNodeVisual node = visuals.get(index);
            if (node.dragging()) {
                node.setVx(0);
                node.setVy(0);
                continue;
            }
            node.setVx((node.vx() + fx[index] * dt) * DAMPING);
            node.setVy((node.vy() + fy[index] * dt) * DAMPING);
            node.setX(clamp(node.x() + node.vx() * dt, NODE_MARGIN, Math.max(NODE_MARGIN, width - NODE_MARGIN)));
            node.setY(clamp(node.y() + node.vy() * dt, NODE_MARGIN, Math.max(NODE_MARGIN, height - NODE_MARGIN)));
            energy += Math.abs(node.vx()) + Math.abs(node.vy());
        }
        return energy;
    }
}
