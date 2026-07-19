package architecture.sessionplanner;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertFalse;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;

@AnalyzeMainClasses
public final class SessionPlannerTargetArchitectureTest {

    private static final Set<String> RETIRED_TYPES = Set.of(
            "features.sessionplanner.api.ApplyGeneratedSessionCommand",
            "features.sessionplanner.api.PreviewGeneratedSessionCommand",
            "features.sessionplanner.api.SessionGenerationDraftChangedCommand",
            "features.sessionplanner.api.SessionGenerationPreviewModel",
            "features.sessionplanner.api.SessionGenerationPreviewSnapshot",
            "features.sessionplanner.api.SessionGenerationPreviewStatus",
            "features.sessionplanner.api.SessionPreparationModel",
            "features.sessionplanner.application.GeneratedSessionAssembly",
            "features.sessionplanner.application.SessionGenerationCoordinator",
            "features.sessionplanner.application.SessionGenerationPreviewProjection",
            "features.sessionplanner.application.SessionGenerationPublishedState",
            "features.sessionplanner.application.SessionGenerationRequestFingerprint",
            "features.sessionplanner.application.SessionPreparationPublishedState",
            "features.sessionplanner.adapter.javafx.SessionGenerationPanel",
            "features.sessionplanner.adapter.javafx.SessionPlannerSummaryView",
            "features.sessionplanner.api.SessionPlannerCatalogModel",
            "features.sessionplanner.api.SessionPlannerCurrentSessionModel",
            "features.sessionplanner.api.SessionPlannerParticipantsModel",
            "features.sessionplanner.api.SessionPlannerSceneTimelineModel",
            "features.sessionplanner.api.SessionPlannerStatePanelModel",
            "features.encounter.api.GeneratedEncounterPlanImportApi",
            "features.encounter.api.GeneratedEncounterPlanImportCommand",
            "features.encounter.api.GeneratedEncounterPlanImportResult",
            "features.encounter.api.GeneratedEncounterPlanRole",
            "features.encounter.api.GeneratedEncounterPlanSlotSpec",
            "features.encounter.api.GeneratedEncounterPlanSource",
            "features.encounter.api.GeneratedEncounterPlanSpec",
            "features.encounter.application.GeneratedEncounterPlanBatchRepository",
            "features.encounter.application.GeneratedEncounterPlanCandidateSource",
            "features.encounter.application.GeneratedEncounterPlanImportService");

    private SessionPlannerTargetArchitectureTest() {
    }

    @ArchTest
    static final ArchRule sessionPlannerJavaFxIsPassive =
            classes()
                    .that()
                    .resideInAPackage("features.sessionplanner.adapter.javafx..")
                    .should(avoidBackendAndForeignImplementationDependencies());

    @ArchTest
    static final ArchRule onlyTheWorkspaceCoordinatorOwnsPlannerPublishedState =
            classes()
                    .that()
                    .resideInAPackage("features.sessionplanner..")
                    .should(allowPublishedStateOnlyInTheWorkspaceCoordinator());

    @ArchTest
    static final ArchRule plannerApiHasOnlyTheTwoTargetModelTypes =
            classes()
                    .that()
                    .resideInAPackage("features.sessionplanner.api..")
                    .and()
                    .haveSimpleNameEndingWith("Model")
                    .should(haveOneOfSimpleNames("SessionPlannerWorkspaceModel", "PreparedSceneCatalogModel"));

    @ArchTest
    static final ArchRule javaFxConsumesOnlyTheWorkspaceViewModel =
            classes()
                    .that()
                    .resideInAPackage("features.sessionplanner.adapter.javafx..")
                    .should(consumeNoPlannerModelExceptWorkspace());

    @ArchTest
    static final ArchRule plannerHasOnlyTheTargetBinder =
            classes()
                    .that()
                    .resideInAPackage("features.sessionplanner..")
                    .and()
                    .haveSimpleNameEndingWith("Binder")
                    .should()
                    .haveSimpleName("SessionPlannerBinder");

    @ArchTest
    static final ArchRule plannerHasOnlyTheTargetPublicationCoordinator =
            classes()
                    .that()
                    .resideInAPackage("features.sessionplanner..")
                    .and()
                    .haveSimpleNameEndingWith("PublicationCoordinator")
                    .should()
                    .haveSimpleName("SessionPlannerWorkspacePublicationCoordinator");

    @ArchTest
    static final ArchRule preparationNeverUsesTheGlobalSerialLane =
            noClasses()
                    .that()
                    .resideInAPackage("features.sessionplanner.application..")
                    .and()
                    .haveSimpleNameContaining("Preparation")
                    .should()
                    .dependOnClassesThat()
                    .haveFullyQualifiedName("platform.execution.SerialExecutionLane");

    @ArchTest
    static void oneWorkspaceViewPublicationAndNoRetiredSymbols(JavaClasses classes) {
        Set<String> present = classes.stream().map(JavaClass::getFullName).collect(java.util.stream.Collectors.toSet());
        RETIRED_TYPES.forEach(type -> assertFalse(present.contains(type), () -> type + " is a retired M2-M4 symbol"));
    }

    private static ArchCondition<JavaClass> allowPublishedStateOnlyInTheWorkspaceCoordinator() {
        return new ArchCondition<>("use PublishedState only from SessionPlannerWorkspacePublicationCoordinator") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean dependsOnPublishedState = item.getDirectDependenciesFromSelf().stream()
                        .anyMatch(dependency -> dependency.getTargetClass().getFullName()
                                .equals("platform.state.PublishedState"));
                if (dependsOnPublishedState
                        && !item.getSimpleName().equals("SessionPlannerWorkspacePublicationCoordinator")) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " creates a second Session Planner publication owner"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> consumeNoPlannerModelExceptWorkspace() {
        return new ArchCondition<>("consume only SessionPlannerWorkspaceModel from Session Planner API models") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getDirectDependenciesFromSelf().stream()
                        .map(Dependency::getTargetClass)
                        .filter(target -> target.getPackageName().equals("features.sessionplanner.api"))
                        .filter(target -> target.getSimpleName().endsWith("Model"))
                        .filter(target -> !target.getSimpleName().equals("SessionPlannerWorkspaceModel"))
                        .forEach(target -> events.add(SimpleConditionEvent.violated(
                                item, item.getName() + " consumes duplicate view model " + target.getName())));
            }
        };
    }

    private static ArchCondition<JavaClass> haveOneOfSimpleNames(String... allowedNames) {
        Set<String> allowed = Set.of(allowedNames);
        return new ArchCondition<>("have one of the target names " + allowed) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (!allowed.contains(item.getSimpleName())) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is outside the target allowlist " + allowed));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> avoidBackendAndForeignImplementationDependencies() {
        return new ArchCondition<>("depend only on Session Planner API, JavaFX, shell API, and platform UI") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    String target = dependency.getTargetClass().getPackageName();
                    boolean ownBackend = in(target, "features.sessionplanner.application")
                            || in(target, "features.sessionplanner.adapter.sqlite");
                    boolean platformBackend = in(target, "platform.execution")
                            || in(target, "platform.persistence");
                    boolean foreignImplementation = in(target, "features")
                            && !in(target, "features.sessionplanner")
                            && !target.matches("features\\.[^.]+\\.api(?:\\..*)?");
                    if (ownBackend || platformBackend || foreignImplementation) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                item.getName() + " must not depend on " + dependency.getTargetClass().getName()));
                    }
                }
            }
        };
    }

    private static boolean in(String actual, String expected) {
        return actual.equals(expected) || actual.startsWith(expected + ".");
    }
}
