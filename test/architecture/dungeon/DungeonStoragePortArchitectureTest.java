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
import java.util.Set;

@AnalyzeMainClasses
public final class DungeonStoragePortArchitectureTest {

    private static final String PORTS = "features.dungeon.application.authored.port.";
    private static final String CATALOG_STORE = PORTS + "DungeonCatalogStore";
    private static final String WINDOW_STORE = PORTS + "DungeonWindowStore";
    private static final String WINDOW_CONTENT_SOURCE = PORTS + "DungeonWindowContentSource";
    private static final String UNIT_OF_WORK = PORTS + "DungeonUnitOfWork";
    private static final String IDENTITY_ALLOCATOR = PORTS + "DungeonIdentityAllocator";
    private static final String SQLITE_REPOSITORY = "features.dungeon.adapter.sqlite.repository.";
    private static final String SQLITE_CATALOG_STORE = SQLITE_REPOSITORY + "SqliteDungeonCatalogStore";
    private static final String SQLITE_WINDOW_STORE = SQLITE_REPOSITORY + "SqliteDungeonWindowStore";
    private static final String SQLITE_UNIT_OF_WORK = SQLITE_REPOSITORY + "SqliteDungeonUnitOfWork";
    private static final String SQLITE_IDENTITY_ALLOCATOR = SQLITE_REPOSITORY + "SqliteDungeonIdentityAllocator";
    private static final String AUTHORED_SERVICE =
            "features.dungeon.application.authored.DungeonAuthoredApplicationService";
    private static final String AUTHORED_API = "features.dungeon.api.authored.DungeonAuthoredApi";
    private static final String COMMAND_WORKSET =
            "features.dungeon.application.authored.DungeonCommandWorkset";
    private static final String DUNGEON_MAP = "features.dungeon.domain.core.structure.DungeonMap";

    private DungeonStoragePortArchitectureTest() {
    }

    @ArchTest
    static final ArchRule authoredServiceUsesExactlyTheFourStorageCapabilities =
            classes()
                    .that().haveFullyQualifiedName(AUTHORED_SERVICE)
                    .should().dependOnClassesThat().haveFullyQualifiedName(CATALOG_STORE)
                    .andShould().dependOnClassesThat().haveFullyQualifiedName(WINDOW_STORE)
                    .andShould().dependOnClassesThat().haveFullyQualifiedName(UNIT_OF_WORK)
                    .andShould().dependOnClassesThat().haveFullyQualifiedName(IDENTITY_ALLOCATOR)
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule authoredApplicationDoesNotReachSQLiteAdapters =
            noClasses()
                    .that().resideInAPackage("features.dungeon.application.authored..")
                    .should().dependOnClassesThat().resideInAPackage("features.dungeon.adapter.sqlite..");

    @ArchTest
    static final ArchRule travelDoesNotDependOnAuthoredServiceOrDungeonMap =
            noClasses()
                    .that().resideInAPackage("features.dungeon.application.travel..")
                    .should().dependOnClassesThat().haveFullyQualifiedName(AUTHORED_SERVICE)
                    .orShould().dependOnClassesThat().haveFullyQualifiedName(DUNGEON_MAP);

    @ArchTest
    static final ArchRule onlyCommandWorksetOwnsACommandScopedDungeonMap =
            classes()
                    .that().resideInAPackage("features.dungeon.application.authored..")
                    .should(ownDungeonMapOnlyInMarkedWorkset())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteCatalogDirectlyImplementsOnlyCatalog =
            classes().that().haveFullyQualifiedName(SQLITE_CATALOG_STORE)
                    .should(directlyImplementOnly(CATALOG_STORE)).allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteWindowDirectlyImplementsOnlyContentSource =
            classes().that().haveFullyQualifiedName(SQLITE_WINDOW_STORE)
                    .should(directlyImplementOnly(WINDOW_CONTENT_SOURCE)).allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteUnitOfWorkDirectlyImplementsOnlyUnitOfWork =
            classes().that().haveFullyQualifiedName(SQLITE_UNIT_OF_WORK)
                    .should(directlyImplementOnly(UNIT_OF_WORK)).allowEmptyShould(false);

    @ArchTest
    static final ArchRule sqliteIdentityAllocatorDirectlyImplementsOnlyIdentityAllocator =
            classes().that().haveFullyQualifiedName(SQLITE_IDENTITY_ALLOCATOR)
                    .should(directlyImplementOnly(IDENTITY_ALLOCATOR)).allowEmptyShould(false);

    @ArchTest
    static final ArchRule productionSQLiteContainsOnlyTargetStorageTypes =
            classes()
                    .that().resideInAPackage("features.dungeon.adapter.sqlite..")
                    .should(notHaveRetiredWholeMapNames(Set.of(
                            "SqliteDungeonMapRepository",
                            "DungeonSqliteMapRecordLoader",
                            "DungeonSqliteMapRecordWriter",
                            "DungeonSqliteMapBatchGateway",
                            "DungeonMapRecordMapper",
                            "DungeonMapRecord",
                            "DungeonGridBoundsRecord",
                            "DungeonSqliteChunkWriter",
                            "DungeonSqliteIdentityReservation")))
                    .andShould(notExposeMethodsNamed(Set.of(
                            "findMap", "firstMap", "findById", "saveAll", "saveMaps",
                            "rebuildDerivedSpatialIndexes")))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule persistenceBackedAuthoredApiIsAsynchronous =
            classes().that().haveFullyQualifiedName(AUTHORED_API)
                    .should().dependOnClassesThat().haveFullyQualifiedName("java.util.concurrent.CompletionStage");

    @ArchTest
    static final ArchRule authoredServiceDispatchesPublicPersistenceReadsToExecutionLane =
            classes().that().haveFullyQualifiedName(AUTHORED_SERVICE)
                    .should().dependOnClassesThat().haveFullyQualifiedName("platform.execution.ExecutionLane");

    private static ArchCondition<JavaClass> directlyImplementOnly(String interfaceName) {
        return new ArchCondition<>("directly implement only " + interfaceName) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                Set<String> interfaces = item.getInterfaces().stream()
                        .map(interfaceType -> interfaceType.getName())
                        .collect(java.util.stream.Collectors.toUnmodifiableSet());
                if (!interfaces.equals(Set.of(interfaceName))) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " directly implements " + interfaces));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> ownDungeonMapOnlyInMarkedWorkset() {
        return new ArchCondition<>("own DungeonMap fields only in " + COMMAND_WORKSET) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (item.getName().equals(COMMAND_WORKSET)) {
                    return;
                }
                item.getFields().stream()
                        .filter(field -> !field.getModifiers().contains(JavaModifier.STATIC))
                        .filter(field -> field.getRawType().getName().equals(DUNGEON_MAP))
                        .forEach(field -> events.add(SimpleConditionEvent.violated(
                                field, item.getName() + " owns an unmarked DungeonMap field")));
            }
        };
    }

    private static ArchCondition<JavaClass> notHaveRetiredWholeMapNames(Set<String> forbiddenNames) {
        return new ArchCondition<>("not have retired whole-map simple names " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (forbiddenNames.contains(item.getSimpleName())) {
                    events.add(SimpleConditionEvent.violated(item, item.getName() + " is a retired whole-map type"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notExposeMethodsNamed(Set<String> forbiddenNames) {
        return new ArchCondition<>("not expose whole-map methods " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getMethods().stream()
                        .filter(method -> forbiddenNames.contains(method.getName()))
                        .forEach(method -> events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " is a forbidden whole-map surface")));
            }
        };
    }
}
