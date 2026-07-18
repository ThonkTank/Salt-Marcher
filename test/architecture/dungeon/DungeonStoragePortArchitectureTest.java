package architecture.dungeon;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@AnalyzeMainClasses
public final class DungeonStoragePortArchitectureTest {

    private static final String CATALOG_STORE =
            "features.dungeon.application.authored.port.DungeonCatalogStore";
    private static final String WINDOW_STORE =
            "features.dungeon.application.authored.port.DungeonWindowStore";
    private static final String SQLITE_WINDOW_STORE =
            "features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore";
    private static final String MAP_REPOSITORY =
            "features.dungeon.application.authored.port.DungeonMapRepository";
    private static final String UNIT_OF_WORK =
            "features.dungeon.application.authored.port.DungeonUnitOfWork";
    private static final String SQLITE_UNIT_OF_WORK =
            "features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork";
    private static final String DUNGEON_MAP =
            "features.dungeon.domain.core.structure.DungeonMap";
    private static final String DUNGEON_MAP_RECORD =
            "features.dungeon.adapter.sqlite.model.DungeonMapRecord";
    private static final String FULL_MAP_RECORD_MAPPER =
            "features.dungeon.adapter.sqlite.mapper.DungeonMapRecordMapper";
    private static final String FULL_MAP_RECORD_LOADER =
            "features.dungeon.adapter.sqlite.gateway.DungeonSqliteMapRecordLoader";
    private static final String FULL_MAP_RECORD_WRITER =
            "features.dungeon.adapter.sqlite.gateway.DungeonSqliteMapRecordWriter";
    private static final String FULL_MAP_BATCH_GATEWAY =
            "features.dungeon.adapter.sqlite.gateway.DungeonSqliteMapBatchGateway";
    private static final String FULL_MAP_CONNECTION_SUPPORT =
            "features.dungeon.adapter.sqlite.gateway.DungeonSqliteConnectionSupport";
    private static final String SQLITE_PATCH_COMPONENT_PATTERN =
            "features\\.dungeon\\.adapter\\.sqlite\\.(gateway\\.DungeonSqlitePatch.*"
                    + "|mapper\\.DungeonPatchRecordMapper)";
    private static final String SQLITE_CLOSURE_BATCH_LOADER =
            "features.dungeon.adapter.sqlite.gateway.DungeonSqliteClosureBatchLoader";
    private static final String AUTHORED_SERVICE =
            "features.dungeon.application.authored.DungeonAuthoredApplicationService";
    private static final String AUTHORED_API =
            "features.dungeon.api.authored.DungeonAuthoredApi";
    private static final Set<String> FORBIDDEN_UNIT_OF_WORK_DEPENDENCIES = Set.of(
            DUNGEON_MAP,
            DUNGEON_MAP_RECORD,
            FULL_MAP_RECORD_MAPPER,
            FULL_MAP_RECORD_LOADER,
            FULL_MAP_RECORD_WRITER,
            FULL_MAP_BATCH_GATEWAY,
            FULL_MAP_CONNECTION_SUPPORT,
            MAP_REPOSITORY);

    private DungeonStoragePortArchitectureTest() {
    }

    @ArchTest
    static final ArchRule catalogStoreRemainsMetadataOnly =
            noClasses()
                    .that()
                    .haveFullyQualifiedName(CATALOG_STORE)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(DUNGEON_MAP);

    @ArchTest
    static final ArchRule unitOfWorkPortDoesNotCarryCompleteDungeonMaps =
            noClasses()
                    .that()
                    .haveFullyQualifiedName(UNIT_OF_WORK)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(DUNGEON_MAP);

    @ArchTest
    static final ArchRule unitOfWorkPortDoesNotCarryFullPersistenceRecords =
            noClasses()
                    .that()
                    .haveFullyQualifiedName(UNIT_OF_WORK)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(DUNGEON_MAP_RECORD);

    @ArchTest
    static final ArchRule unitOfWorkPortDoesNotFacadeTheWholeMapRepository =
            noClasses()
                    .that()
                    .haveFullyQualifiedName(UNIT_OF_WORK)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(MAP_REPOSITORY);

    @ArchTest
    static final ArchRule authoredServiceUsesTheDedicatedCatalogPort =
            classes()
                    .that()
                    .haveFullyQualifiedName(AUTHORED_SERVICE)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(CATALOG_STORE);

    @ArchTest
    static final ArchRule authoredServiceOrchestratesTheUnitOfWork =
            classes()
                    .that()
                    .haveFullyQualifiedName(AUTHORED_SERVICE)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(UNIT_OF_WORK)
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteUnitOfWorkDirectlyImplementsTheDedicatedPort =
            classes()
                    .that()
                    .haveFullyQualifiedName(SQLITE_UNIT_OF_WORK)
                    .should(directlyImplement(UNIT_OF_WORK))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteUnitOfWorkDependencyPathDoesNotReachWholeMapCompatibilityTypes =
            classes()
                    .that()
                    .haveFullyQualifiedName(SQLITE_UNIT_OF_WORK)
                    .or()
                    .haveNameMatching(SQLITE_PATCH_COMPONENT_PATTERN)
                    .or()
                    .haveFullyQualifiedName(SQLITE_CLOSURE_BATCH_LOADER)
                    .should(avoidWholeMapCompatibilityDependencies())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule wholeMapRepositoryHasNoFullMapWriteMethod =
            classes()
                    .that()
                    .haveFullyQualifiedName(MAP_REPOSITORY)
                    .should(notExposeMethodsNamed("saveAll", "saveMaps"))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule fullMapRecordMapperIsReadOnly =
            classes()
                    .that()
                    .haveFullyQualifiedName(FULL_MAP_RECORD_MAPPER)
                    .should(notExposeMethodsNamed("toRecord"))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule productionSQLiteGatewayHasNoFullMapWriterOrBatchGateway =
            classes()
                    .that()
                    .resideInAPackage("features.dungeon.adapter.sqlite.gateway")
                    .should(notHaveSimpleNames(
                            "DungeonSqliteMapRecordWriter",
                            "DungeonSqliteMapBatchGateway"))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule persistenceBackedAuthoredApiIsAsynchronous =
            classes()
                    .that()
                    .haveFullyQualifiedName(AUTHORED_API)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName("java.util.concurrent.CompletionStage");

    @ArchTest
    static final ArchRule authoredServiceDispatchesPublicPersistenceReadsToExecutionLane =
            classes()
                    .that()
                    .haveFullyQualifiedName(AUTHORED_SERVICE)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName("platform.execution.ExecutionLane");

    @ArchTest
    static final ArchRule windowStoreNeverRepresentsAWindowAsDungeonMap =
            noClasses()
                    .that()
                    .resideInAPackage("features.dungeon.application.authored.port")
                    .and()
                    .haveSimpleNameStartingWith("DungeonWindow")
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(DUNGEON_MAP);

    @ArchTest
    static final ArchRule sqliteWindowStoreImplementsTheDedicatedPort =
            classes()
                    .that()
                    .haveFullyQualifiedName(SQLITE_WINDOW_STORE)
                    .should()
                    .implement(WINDOW_STORE)
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteWindowStoreDoesNotFacadeTheWholeMapRepository =
            noClasses()
                    .that()
                    .haveFullyQualifiedName(SQLITE_WINDOW_STORE)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(MAP_REPOSITORY);

    private static ArchCondition<JavaClass> directlyImplement(String interfaceName) {
        return new ArchCondition<>("directly implement " + interfaceName) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean directlyImplemented = item.getInterfaces().stream()
                        .anyMatch(type -> type.getName().equals(interfaceName));
                if (!directlyImplemented) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must directly implement " + interfaceName));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notExposeMethodsNamed(String... forbiddenNames) {
        Set<String> names = Set.of(forbiddenNames);
        return new ArchCondition<>("not expose methods named " + names) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getMethods().stream()
                        .filter(method -> names.contains(method.getName()))
                        .forEach(method ->
                        events.add(SimpleConditionEvent.violated(
                                method,
                                method.getDescription() + " is a forbidden full-map write surface")));
            }
        };
    }

    private static ArchCondition<JavaClass> notHaveSimpleNames(String... forbiddenNames) {
        Set<String> names = Set.of(forbiddenNames);
        return new ArchCondition<>("not have simple names " + names) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (names.contains(item.getSimpleName())) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " is a forbidden production full-map write surface"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> avoidWholeMapCompatibilityDependencies() {
        return new ArchCondition<>("avoid whole-map compatibility dependencies on the SQLite unit-of-work path") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                List<String> forbiddenPath = forbiddenDependencyPath(item);
                if (!forbiddenPath.isEmpty()) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must not reach a whole-map compatibility type: "
                                    + String.join(" -> ", forbiddenPath)));
                }
            }
        };
    }

    private static List<String> forbiddenDependencyPath(JavaClass origin) {
        Deque<DependencyPath> remaining = new ArrayDeque<>();
        Set<String> visited = new HashSet<>();
        remaining.add(new DependencyPath(origin, List.of(origin.getName())));
        visited.add(origin.getName());
        while (!remaining.isEmpty()) {
            DependencyPath current = remaining.removeFirst();
            for (var dependency : current.type().getDirectDependenciesFromSelf()) {
                JavaClass target = dependency.getTargetClass();
                if (FORBIDDEN_UNIT_OF_WORK_DEPENDENCIES.contains(target.getName())) {
                    List<String> names = new ArrayList<>(current.names());
                    names.add(target.getName());
                    return List.copyOf(names);
                }
            }
            current.type().getFields().stream()
                    .filter(field -> !field.getModifiers().contains(JavaModifier.STATIC))
                    .map(field -> field.getRawType())
                    .filter(type -> type.getName().startsWith("features.dungeon.adapter.sqlite."))
                    .filter(type -> visited.add(type.getName()))
                    .forEach(type -> {
                        List<String> names = new ArrayList<>(current.names());
                        names.add(type.getName());
                        remaining.addLast(new DependencyPath(type, List.copyOf(names)));
                    });
        }
        return List.of();
    }

    private record DependencyPath(JavaClass type, List<String> names) {
    }
}
