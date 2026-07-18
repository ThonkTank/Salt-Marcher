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
    private static final String DUNGEON_MAP =
            "features.dungeon.domain.core.structure.DungeonMap";
    private static final String AUTHORED_SERVICE =
            "features.dungeon.application.authored.DungeonAuthoredApplicationService";

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
}
