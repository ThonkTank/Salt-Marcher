package architecture.dungeon;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaConstructor;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Map;
import java.util.Set;

@AnalyzeMainClasses
public final class DungeonTargetArchitectureTest {

    private static final String DUNGEON = "features.dungeon.";
    private static final String API = DUNGEON + "api.";
    private static final String EDITOR_APPLICATION = DUNGEON + "application.editor.";
    private static final String AUTHORED_APPLICATION = DUNGEON + "application.authored.";
    private static final String AUTHORED_PORT = AUTHORED_APPLICATION + "port.";
    private static final String ROOM_PACKAGE = DUNGEON + "domain.core.structure.room.";

    private static final String ROOM_REGION = ROOM_PACKAGE + "RoomRegion";
    private static final String ROOM_CLUSTER = ROOM_PACKAGE + "RoomCluster";
    private static final String RETIRED_CLUSTER_BOUNDARY = ROOM_PACKAGE + "DungeonClusterBoundary";
    private static final Set<String> RETIRED_RELATIVE_BOUNDARY_SIMPLE_NAMES = Set.of(
            "DungeonClusterBoundary",
            "RoomClusterBoundaryMaterialization",
            "RoomClusterBoundaryMapAdapter",
            "RoomClusterBoundaryOrdering",
            "RoomClusterWallMaterialization",
            "RoomClusterWallRows",
            "RoomClusterWallMap");
    private static final String BOUNDARY_SEGMENT =
            DUNGEON + "domain.core.component.boundary.BoundarySegment";
    private static final String BOUNDARY_MAP =
            DUNGEON + "domain.core.component.boundary.BoundaryMap";

    private static final String DUNGEON_WINDOW = AUTHORED_PORT + "DungeonWindow";
    private static final String DUNGEON_WINDOW_STORE = AUTHORED_PORT + "DungeonWindowStore";
    private static final String CONTINUATION_PAGE = AUTHORED_PORT + "DungeonContinuationPage";
    private static final String CONTINUATION_CURSOR = AUTHORED_PORT + "DungeonContinuationCursor";
    private static final String CONTINUATION_REQUEST = AUTHORED_PORT + "DungeonContinuationPageRequest";
    private static final String VIEWPORT_SNAPSHOT = API + "DungeonViewportSnapshot";
    private static final Set<String> RETIRED_FIXED_BOUNDS_SNAPSHOTS = Set.of(
            API + "DungeonMapSnapshot",
            API + "DungeonEditorMapSnapshot");

    private static final Set<String> RETIRED_EDITOR_READBACK_TYPES = Set.of(
            API + "DungeonEditorControlsModel",
            API + "DungeonEditorControlsSnapshot",
            API + "DungeonEditorMapSurfaceModel",
            API + "DungeonEditorMapSurfaceSnapshot",
            API + "DungeonEditorStateModel",
            API + "DungeonEditorStateSnapshot",
            EDITOR_APPLICATION + "DungeonEditorPublishedState",
            EDITOR_APPLICATION + "DungeonEditorRuntimeReadbackFrameInputs",
            EDITOR_APPLICATION + "DungeonEditorRuntimeDependencies$CompatibilityReadbackModels");

    private static final Set<String> RETIRED_EDITOR_INPUT_ADAPTERS = Set.of(
            EDITOR_APPLICATION + "DungeonEditorRuntimeInputTranslator",
            EDITOR_APPLICATION + "DungeonEditorRuntimeInputValues",
            EDITOR_APPLICATION + "DungeonEditorRuntimePointerTarget",
            EDITOR_APPLICATION + "DungeonEditorRuntimeDraftFrame");

    private static final Set<String> RETIRED_WHOLE_MAP_SIMPLE_NAMES = Set.of(
            "DungeonMapRepository",
            "SqliteDungeonMapRepository",
            "DungeonMapRecord",
            "DungeonGridBoundsRecord",
            "DungeonMapRecordMapper",
            "DungeonSqliteMapRecordLoader",
            "DungeonSqliteMapRecordWriter",
            "DungeonSqliteChunkWriter",
            "DungeonSqliteIdentityReservation",
            "DungeonSqliteFixtureSpatialIndex");

    private DungeonTargetArchitectureTest() {
    }

    @ArchTest
    static final ArchRule retiredEditorReadbackAndInputFamiliesAreAbsent =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .should(notHaveExactNames(union(
                            RETIRED_EDITOR_READBACK_TYPES,
                            RETIRED_EDITOR_INPUT_ADAPTERS)))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule preparedRenderFramesRemainJavaFxLocal =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .and().resideOutsideOfPackage("features.dungeon.adapter.javafx..")
                    .should(notBeRenderFrameTypes())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule productionContainsNoRetiredWholeMapTypes =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .should(notHaveSimpleNames(RETIRED_WHOLE_MAP_SIMPLE_NAMES))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule dungeonApiPublishesNoFixedAuthoredDimensions =
            classes()
                    .that().resideInAPackage("features.dungeon.api..")
                    .should(notDeclareFixedBoundsOnExactSnapshots())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule authoredProjectionContainsNoRetiredWorkspaceBoundsHelper =
            classes()
                    .that().resideInAPackage("features.dungeon.application.authored..")
                    .should(notDeclareWorkspaceBoundsHelper())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule roomRegionOwnsOnlyCanonicalAuthoredFacts =
            classes()
                    .that().haveFullyQualifiedName(ROOM_REGION)
                    .should(haveExactInstanceFields(Map.of(
                            "roomId", "long",
                            "mapId", "long",
                            "clusterId", "long",
                            "name", "java.lang.String",
                            "floorCells", "java.util.Set",
                            "narration", ROOM_PACKAGE + "DungeonRoomNarration")))
                    .andShould(notExposeMethodsNamed(Set.of("floorAnchors", "anchorsByLevel")))
                    .andShould(notDeclareConstructorsWithRawParameter("java.util.Map"))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule roomClusterOwnsCanonicalAbsoluteBoundaries =
            classes()
                    .that().haveFullyQualifiedName(ROOM_CLUSTER)
                    .should(notDeclareFieldsNamed(Set.of("center", "boundariesByLevel")))
                    .andShould(notExposeMethodsNamed(Set.of("center")))
                    .andShould().dependOnClassesThat().haveFullyQualifiedName(BOUNDARY_SEGMENT)
                    .andShould().dependOnClassesThat().haveFullyQualifiedName(BOUNDARY_MAP)
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule retiredRelativeClusterBoundaryTypeIsAbsent =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .should(notHaveExactNames(Set.of(RETIRED_CLUSTER_BOUNDARY)))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule relativeBoundaryCompatibilityFamilyIsAbsent =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .should(notHaveSimpleNames(RETIRED_RELATIVE_BOUNDARY_SIMPLE_NAMES))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule typedContinuationPageRemainsPresent =
            classes()
                    .that().haveFullyQualifiedName(CONTINUATION_PAGE)
                    .should(haveOneOfExactNames(Set.of(CONTINUATION_PAGE)))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule typedContinuationCursorRemainsPresent =
            classes()
                    .that().haveFullyQualifiedName(CONTINUATION_CURSOR)
                    .should(haveOneOfExactNames(Set.of(CONTINUATION_CURSOR)))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule typedContinuationRequestRemainsPresent =
            classes()
                    .that().haveFullyQualifiedName(CONTINUATION_REQUEST)
                    .should(haveOneOfExactNames(Set.of(CONTINUATION_REQUEST)))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule windowStoreExposesTypedContinuationPaging =
            classes()
                    .that().haveFullyQualifiedName(DUNGEON_WINDOW_STORE)
                    .should().dependOnClassesThat().haveFullyQualifiedName(CONTINUATION_PAGE)
                    .andShould().dependOnClassesThat().haveFullyQualifiedName(CONTINUATION_REQUEST)
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule windowAndViewportExposePagesWithoutListCompatibility =
            classes()
                    .that().haveFullyQualifiedName(DUNGEON_WINDOW)
                    .or().haveFullyQualifiedName(VIEWPORT_SNAPSHOT)
                    .should(notExposeMethodsNamed(Set.of("continuations")))
                    .andShould(notDeclareFiveArgumentConstructors())
                    .allowEmptyShould(false);

    private static ArchCondition<JavaClass> notHaveExactNames(Set<String> forbiddenNames) {
        return new ArchCondition<>("not have retired exact names " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (forbiddenNames.contains(item.getName())) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is a retired Dungeon target-boundary type"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> haveOneOfExactNames(Set<String> requiredNames) {
        return new ArchCondition<>("have one of the required exact names " + requiredNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!requiredNames.contains(item.getName())) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is not a typed continuation paging contract"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notBeRenderFrameTypes() {
        return new ArchCondition<>("not own prepared render-frame types outside JavaFX") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (item.getSimpleName().contains("RenderFrame")) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " owns prepared render-frame facts outside JavaFX"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notHaveSimpleNames(Set<String> forbiddenNames) {
        return new ArchCondition<>("not have retired whole-map simple names " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (forbiddenNames.contains(item.getSimpleName())) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is a retired whole-map type"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notDeclareFieldsNamed(Set<String> forbiddenNames) {
        return new ArchCondition<>("not declare fields named " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                instanceFields(item).stream()
                        .filter(field -> forbiddenNames.contains(field.getName()))
                        .forEach(field -> events.add(SimpleConditionEvent.violated(
                                field, field.getFullName() + " is retired authored shape")));
            }
        };
    }

    private static ArchCondition<JavaClass> notDeclareFixedBoundsOnExactSnapshots() {
        return new ArchCondition<>("not declare fixed authored dimensions on retired map snapshots") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!RETIRED_FIXED_BOUNDS_SNAPSHOTS.contains(item.getName())) {
                    return;
                }
                instanceFields(item).stream()
                        .filter(field -> field.getName().equals("width") || field.getName().equals("height"))
                        .forEach(field -> events.add(SimpleConditionEvent.violated(
                                field, field.getFullName() + " is a retired fixed authored bound")));
            }
        };
    }

    private static ArchCondition<JavaClass> notDeclareWorkspaceBoundsHelper() {
        return new ArchCondition<>("not declare the retired workspace-bounds helper") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (item.getSimpleName().equals("WorkspaceBounds")) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is the retired workspace-bounds type"));
                }
                item.getMethods().stream()
                        .filter(method -> method.getName().equals("workspaceBounds"))
                        .forEach(method -> events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " is the retired workspace-bounds helper")));
            }
        };
    }

    private static ArchCondition<JavaClass> haveExactInstanceFields(Map<String, String> expectedFields) {
        return new ArchCondition<>("have exact instance fields " + expectedFields) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                Map<String, String> actualFields = instanceFields(item).stream()
                        .collect(java.util.stream.Collectors.toUnmodifiableMap(
                                JavaField::getName,
                                field -> field.getRawType().getName()));
                if (!actualFields.equals(expectedFields)) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " declares " + actualFields + " instead of " + expectedFields));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notExposeMethodsNamed(Set<String> forbiddenNames) {
        return new ArchCondition<>("not expose methods named " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getMethods().stream()
                        .filter(method -> forbiddenNames.contains(method.getName()))
                        .forEach(method -> events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " is a retired surface")));
            }
        };
    }

    private static ArchCondition<JavaClass> notDeclareConstructorsWithRawParameter(String typeName) {
        return new ArchCondition<>("not declare constructors with raw parameter " + typeName) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (JavaConstructor constructor : item.getConstructors()) {
                    if (constructor.getRawParameterTypes().stream()
                            .anyMatch(type -> type.getName().equals(typeName))) {
                        events.add(SimpleConditionEvent.violated(
                                constructor,
                                constructor.getDescription() + " is a retired constructor"));
                    }
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notDeclareFiveArgumentConstructors() {
        return new ArchCondition<>("not declare the retired five-argument continuation constructor") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!item.getName().equals(DUNGEON_WINDOW)) {
                    return;
                }
                item.getConstructors().stream()
                        .filter(constructor -> constructor.getRawParameterTypes().size() == 5)
                        .forEach(constructor -> events.add(SimpleConditionEvent.violated(
                                constructor,
                                constructor.getDescription() + " is the retired list-continuation constructor")));
            }
        };
    }

    private static Set<String> union(Set<String> first, Set<String> second) {
        Set<String> result = new java.util.LinkedHashSet<>(first);
        result.addAll(second);
        return Set.copyOf(result);
    }

    private static Set<JavaField> instanceFields(JavaClass item) {
        return item.getFields().stream()
                .filter(field -> !field.getModifiers().contains(JavaModifier.STATIC))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}
