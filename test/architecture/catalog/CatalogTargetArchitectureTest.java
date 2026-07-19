package architecture.catalog;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import features.catalog.application.CatalogSectionDefinition;
import features.catalog.application.CatalogSectionDefinitions;
import features.catalog.application.CatalogWorkspacePublication;
import features.creatures.api.CreatureReferenceIndexModel;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@AnalyzeMainClasses
@Tag("architecture")
public final class CatalogTargetArchitectureTest {

    private static final Set<String> RETIRED_TYPES = Set.of(
            "LegacyCatalogBindingAdapter", "CatalogDataSources", "CatalogActionRoutes",
            "MonsterCatalogState", "ItemsCatalogState", "SavedEncounterCatalogState",
            "WorldReferenceCatalogState", "EncounterTableCatalogState",
            "MonsterCatalogIntent", "ItemsCatalogIntent", "SavedEncounterCatalogIntent",
            "WorldReferenceCatalogIntent", "EncounterTableCatalogIntent");
    private static final List<String> RETIRED_PRESENTATION_TYPES = List.of(
            "features.catalog.adapter.javafx.MonsterCatalogSection",
            "features.catalog.adapter.javafx.ItemsCatalogSection",
            "features.catalog.adapter.javafx.SavedEncounterCatalogSection",
            "features.catalog.adapter.javafx.NpcCatalogSection",
            "features.catalog.adapter.javafx.FactionCatalogSection",
            "features.catalog.adapter.javafx.LocationCatalogSection",
            "features.catalog.adapter.javafx.EncounterTableCatalogSection",
            "features.catalog.adapter.javafx.MonsterCatalogControls",
            "features.catalog.adapter.javafx.CatalogTableScaffold",
            "features.catalog.adapter.javafx.CatalogSection",
            "features.catalog.adapter.javafx.CatalogControlsHost",
            "features.catalog.adapter.javafx.CatalogContentHost");
    private static final List<Class<?>> TYPED_DEFINITIONS = List.of(
            features.catalog.application.MonsterCatalogDefinition.class,
            features.catalog.application.ItemsCatalogDefinition.class,
            features.catalog.application.SavedEncounterCatalogDefinition.class,
            features.catalog.application.NpcCatalogDefinition.class,
            features.catalog.application.FactionCatalogDefinition.class,
            features.catalog.application.LocationCatalogDefinition.class,
            features.catalog.application.EncounterTableCatalogDefinition.class);
    private static final List<Class<?>> REQUIRED_ATOMIC_MODELS = List.of(
            CreatureReferenceIndexModel.class,
            EncounterPoolFiltersModel.class,
            SavedEncounterPlanListModel.class,
            EncounterTableCatalogModel.class,
            WorldPlannerSnapshotModel.class);

    private CatalogTargetArchitectureTest() {
    }

    @ArchTest
    static final ArchRule retiredCatalogTypesCannotReturn =
            classes()
                    .that()
                    .resideInAPackage("features.catalog..")
                    .should(notHaveRetiredName());

    @ArchTest
    static final ArchRule catalogJavaFxMustNotOwnWorkspacePublicationObservation =
            noClasses()
                    .that()
                    .resideInAPackage("features.catalog.adapter.javafx..")
                    .should()
                    .dependOnClassesThat()
                    .areAssignableTo(CatalogWorkspacePublication.class);

    @ArchTest
    static final ArchRule catalogJavaFxMustNotKnowStaticSectionComposition =
            noClasses()
                    .that()
                    .resideInAPackage("features.catalog.adapter.javafx..")
                    .should()
                    .dependOnClassesThat()
                    .areAssignableTo(CatalogSectionDefinitions.class);

    @ArchTest
    static final ArchRule catalogApplicationMustRemainFrameworkNeutral =
            noClasses()
                    .that()
                    .resideInAPackage("features.catalog.application..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("javafx..");

    @ArchTest
    static final ArchRule onlySharedCatalogPresentationMayConstructJavaFxControls =
            classes()
                    .that()
                    .resideInAPackage("features.catalog.adapter.javafx..")
                    .should(onlySharedPresentationDependsOnControls());

    @Test
    void exactlySevenTypedDefinitionsUseTheCommonContract() {
        assertEquals(7, TYPED_DEFINITIONS.size());
        for (Class<?> definition : TYPED_DEFINITIONS) {
            assertTrue(CatalogSectionDefinition.class.isAssignableFrom(definition),
                    () -> definition.getName() + " does not implement CatalogSectionDefinition");
        }
    }

    @Test
    void parallelCatalogPresentationTypesStayDeleted() {
        for (String retired : RETIRED_PRESENTATION_TYPES) {
            assertThrows(ClassNotFoundException.class, () -> Class.forName(retired),
                    () -> retired + " restored a parallel Catalog presentation path");
        }
    }

    @Test
    void catalogProviderModelsRequireAtomicObservationAtConstruction() {
        Supplier<Object> current = Object::new;
        Function<Object, Runnable> observation = ignored -> () -> { };
        for (Class<?> model : REQUIRED_ATOMIC_MODELS) {
            Constructor<?>[] constructors = model.getConstructors();
            assertEquals(1, constructors.length, () -> model.getName() + " exposes compatibility constructors");
            Constructor<?> constructor = constructors[0];
            assertEquals(3, constructor.getParameterCount(),
                    () -> model.getName() + " does not require atomic observation");
            for (int missing = 0; missing < constructor.getParameterCount(); missing++) {
                Object[] arguments = {current, observation, observation};
                arguments[missing] = null;
                InvocationTargetException failure = org.junit.jupiter.api.Assertions.assertThrows(
                        InvocationTargetException.class, () -> constructor.newInstance(arguments));
                assertTrue(failure.getCause() instanceof NullPointerException,
                        () -> model.getName() + " accepts a missing constructor collaborator");
            }
        }
    }

    private static ArchCondition<JavaClass> notHaveRetiredName() {
        return new ArchCondition<>("not restore retired Catalog migration types") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (RETIRED_TYPES.contains(item.getSimpleName())) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is a retired Catalog migration type"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> onlySharedPresentationDependsOnControls() {
        Set<String> owners = Set.of("CatalogSectionRenderer", "CatalogControlFactory");
        return new ArchCondition<>("construct JavaFX controls only in the shared renderer or factory") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean dependsOnControl = item.getDirectDependenciesFromSelf().stream()
                        .anyMatch(dependency -> dependency.getTargetClass().getPackageName()
                                .startsWith("javafx.scene.control"));
                boolean sharedOwner = owners.contains(item.getSimpleName())
                        || item.getName().startsWith(
                                "features.catalog.adapter.javafx.CatalogSectionRenderer$")
                        || item.getName().startsWith(
                                "features.catalog.adapter.javafx.CatalogControlFactory$");
                if (dependsOnControl && !sharedOwner) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " constructs a parallel Catalog control path"));
                }
            }
        };
    }
}
