package architecture.catalog;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import features.catalog.adapter.javafx.CatalogSection;
import features.catalog.adapter.javafx.CatalogControlsScaffold;
import features.catalog.adapter.javafx.CatalogTableScaffold;
import features.catalog.application.CatalogWorkspacePublication;
import features.creatures.api.CreatureReferenceIndexModel;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
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
            "LegacyCatalogBindingAdapter", "CatalogDataSources", "CatalogActionRoutes");
    private static final List<String> NATIVE_SECTION_NAMES = List.of(
            "features.catalog.adapter.javafx.MonsterCatalogSection",
            "features.catalog.adapter.javafx.ItemsCatalogSection",
            "features.catalog.adapter.javafx.SavedEncounterCatalogSection",
            "features.catalog.adapter.javafx.NpcCatalogSection",
            "features.catalog.adapter.javafx.FactionCatalogSection",
            "features.catalog.adapter.javafx.LocationCatalogSection",
            "features.catalog.adapter.javafx.EncounterTableCatalogSection");
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

    @Test
    void exactlySevenNativeSectionsUseTheCommonContractAndScaffold() throws ClassNotFoundException {
        assertEquals(7, NATIVE_SECTION_NAMES.size());
        for (String sectionName : NATIVE_SECTION_NAMES) {
            Class<?> section = Class.forName(sectionName);
            assertTrue(CatalogSection.class.isAssignableFrom(section),
                    () -> section.getName() + " does not implement CatalogSection");
            assertTrue(List.of(section.getDeclaredFields()).stream()
                            .map(Field::getType)
                            .anyMatch(CatalogTableScaffold.class::isAssignableFrom),
                    () -> section.getName() + " does not own CatalogTableScaffold");
            assertTrue(List.of(section.getDeclaredFields()).stream()
                            .map(Field::getType)
                            .anyMatch(CatalogControlsScaffold.class::isAssignableFrom),
                    () -> section.getName() + " does not own CatalogControlsScaffold");
        }
    }

    @Test
    void scaffoldSelectionAbsenceIsExplicitlyTyped() throws NoSuchFieldException {
        Field selectionAction = CatalogTableScaffold.class.getDeclaredField("selectionAction");
        assertEquals("java.util.function.Consumer<java.util.Optional<Id>>",
                selectionAction.getGenericType().getTypeName());
        Method render = List.of(CatalogTableScaffold.class.getDeclaredMethods()).stream()
                .filter(method -> method.getName().equals("render"))
                .findFirst()
                .orElseThrow();
        assertEquals("java.util.Optional<Id>", render.getGenericParameterTypes()[1].getTypeName());
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
}
