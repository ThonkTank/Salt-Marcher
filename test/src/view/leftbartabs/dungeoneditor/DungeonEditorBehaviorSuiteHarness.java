package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class DungeonEditorBehaviorSuiteHarness {

    private static final Map<String, Suite> SUITES = suites();

    private DungeonEditorBehaviorSuiteHarness() {
    }

    public static void main(String[] args) throws Exception {
        if (args != null && args.length == 1 && "--list".equals(args[0])) {
            System.out.println(String.join(System.lineSeparator(), suiteIds()));
            return;
        }
        List<String> requested = args == null || args.length == 0
                ? List.of("all")
                : List.of(args);
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Editor behavior suite harness",
                results -> run(requested, results));
    }

    static void run(List<String> requestedSuites, List<String> results) throws Exception {
        for (Suite suite : resolve(requestedSuites)) {
            suite.runner().run(results);
        }
    }

    static List<String> suiteIds() {
        return List.copyOf(SUITES.keySet());
    }

    private static List<Suite> resolve(List<String> requestedSuites) {
        LinkedHashSet<String> resolved = new LinkedHashSet<>();
        List<String> safeRequested = requestedSuites == null || requestedSuites.isEmpty()
                ? List.of("all")
                : requestedSuites;
        for (String requested : safeRequested) {
            addResolved(normalize(requested), resolved);
        }
        List<Suite> result = new ArrayList<>();
        for (String suiteId : resolved) {
            result.add(SUITES.get(suiteId));
        }
        return List.copyOf(result);
    }

    private static void addResolved(String suiteId, Set<String> resolved) {
        Suite suite = SUITES.get(suiteId);
        if (suite == null) {
            throw new IllegalArgumentException("Unknown Dungeon Editor behavior suite: " + suiteId
                    + ". Known suites: " + String.join(", ", SUITES.keySet()));
        }
        for (String dependency : suite.dependencies()) {
            addResolved(dependency, resolved);
        }
        if (!suite.alias()) {
            resolved.add(suiteId);
        }
    }

    private static String normalize(String suiteId) {
        return suiteId == null ? "all" : suiteId.trim().toLowerCase(Locale.ROOT);
    }

    private static Map<String, Suite> suites() {
        Map<String, Suite> result = new LinkedHashMap<>();
        add(result, "geometry", runner(DungeonGeometryInvariantHarness::run));
        add(result, "component", List.of("geometry"), runner(DungeonComponentInvariantHarness::run));
        add(result, "floor", List.of("geometry", "component"), runner(DungeonFloorInvariantHarness::run));
        add(result, "wall-core", List.of("floor"), runner(DungeonWallInvariantHarness::run));
        add(result, "door-core", List.of("wall-core"), runner(DungeonDoorInvariantHarness::run));
        add(result, "path-core", List.of("wall-core"), runner(DungeonPathInvariantHarness::run));
        add(result, "corridor-core", List.of("door-core", "path-core"), runner(DungeonCorridorInvariantHarness::run));
        add(result, "stair-core", List.of("path-core"), runner(DungeonStairInvariantHarness::run));
        add(result, "transition-core", List.of("path-core"), runner(DungeonTransitionInvariantHarness::run));
        add(result, "runtime-projection", List.of("door-core", "path-core", "transition-core"),
                runner(DungeonRuntimeProjectionInvariantHarness::run));
        add(result, "topology", List.of("door-core", "transition-core"), runner(DungeonTopologyInvariantHarness::run));
        add(result, "cluster-core", List.of("wall-core"), runner(DungeonClusterInvariantHarness::run));
        add(result, "room-core", List.of("floor", "wall-core"), runner(DungeonRoomInvariantHarness::run));
        add(result, "structure", List.of("corridor-core", "stair-core", "transition-core", "room-core"),
                runner(DungeonStructureInvariantHarness::run));
        add(result, "map-catalog", runner(DungeonEditorMapCatalogHarness::run));
        add(result, "map-controls", runner(DungeonEditorMapControlsHarness::run));
        add(result, "projection-overlay", runner(DungeonEditorProjectionOverlayHarness::run));
        add(result, "selection", List.of("map-catalog", "door-core", "stair-core"),
                runner(DungeonEditorSelectionHarness::run));
        add(result, "stairs", List.of("selection", "stair-core"), runner(DungeonEditorStairHarness::run));
        add(result, "transitions", List.of("selection", "transition-core"),
                runner(DungeonEditorTransitionHarness::run));
        add(result, "corridors", List.of("selection", "corridor-core"), runner(DungeonEditorCorridorHarness::run));
        add(result, "labels", List.of("selection", "cluster-core"),
                runner(DungeonEditorClusterLabelHandleHarness::runLabels));
        add(result, "shared-handles", List.of("selection", "cluster-core", "door-core", "stair-core"),
                runner(DungeonEditorClusterLabelHandleHarness::runSharedHandles));
        add(result, "door-handles", List.of("selection", "door-core"),
                runner(DungeonEditorClusterLabelHandleHarness::runDoorHandles));
        add(result, "cluster-handles", List.of("selection", "cluster-core"),
                runner(DungeonEditorClusterLabelHandleHarness::runClusterHandles));
        add(result, "cluster-routes", List.of("selection", "cluster-core", "cluster-handles"),
                runner(DungeonEditorRoomWallDoorHarness::runClusterMovement));
        add(result, "doors", List.of("selection", "door-core", "door-handles"),
                runner(DungeonEditorRoomWallDoorHarness::runDoor));
        add(result, "rooms", List.of("selection", "room-core"), runner(DungeonEditorRoomWallDoorHarness::runRoom));
        add(result, "walls", List.of("selection", "wall-core"), runner(DungeonEditorRoomWallDoorHarness::runWall));
        alias(result, "core", List.of(
                "geometry",
                "component",
                "floor",
                "wall-core",
                "door-core",
                "path-core",
                "corridor-core",
                "stair-core",
                "transition-core",
                "runtime-projection",
                "topology",
                "cluster-core",
                "room-core",
                "structure"));
        alias(result, "routes", List.of(
                "map-catalog",
                "map-controls",
                "projection-overlay",
                "selection",
                "stairs",
                "transitions",
                "corridors",
                "labels",
                "shared-handles",
                "door-handles",
                "cluster-handles",
                "cluster-routes",
                "doors",
                "rooms",
                "walls"));
        alias(result, "all", List.of("core", "routes"));
        return Collections.unmodifiableMap(result);
    }

    private static void add(Map<String, Suite> suites, String id, SuiteRunner runner) {
        add(suites, id, List.of(), runner);
    }

    private static void add(Map<String, Suite> suites, String id, List<String> dependencies, SuiteRunner runner) {
        suites.put(id, new Suite(dependencies, runner, false));
    }

    private static void alias(Map<String, Suite> suites, String id, List<String> dependencies) {
        suites.put(id, new Suite(dependencies, results -> { }, true));
    }

    private static SuiteRunner runner(SuiteRunner runner) {
        return runner;
    }

    private record Suite(List<String> dependencies, SuiteRunner runner, boolean alias) {
        private Suite {
            dependencies = dependencies == null ? List.of() : List.copyOf(dependencies);
        }
    }

    @FunctionalInterface
    interface SuiteRunner {
        void run(List<String> results) throws Exception;
    }
}
