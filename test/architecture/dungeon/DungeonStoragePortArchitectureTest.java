package architecture.dungeon;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

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
    private static final String DUNGEON_MAP =
            "features.dungeon.domain.core.structure.DungeonMap";
    private static final String AUTHORED_SERVICE =
            "features.dungeon.application.authored.DungeonAuthoredApplicationService";
    private static final String AUTHORED_API =
            "features.dungeon.api.authored.DungeonAuthoredApi";

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
    static final ArchRule authoredServiceUsesTheDedicatedCatalogPort =
            classes()
                    .that()
                    .haveFullyQualifiedName(AUTHORED_SERVICE)
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName(CATALOG_STORE);

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
}
