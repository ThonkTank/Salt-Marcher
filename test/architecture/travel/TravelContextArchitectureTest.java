package architecture.travel;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertEquals;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

@AnalyzeMainClasses
public final class TravelContextArchitectureTest {

    private static final String TRAVEL_ROOT = "features.travel..";
    private static final String TRAVEL_APPLICATION = "features.travel.application..";
    private static final String TRAVEL_CONTRIBUTION =
            "features.travel.adapter.javafx.TravelStateContribution";
    private static final String SHELL_STATE_TAB_SPEC = "shell.api.ShellStateTabSpec";
    private static final String DUNGEON_ACTION_ID = "features.dungeon.api.DungeonTravelActionId";
    private static final Set<String> FOREIGN_FEATURES = Set.of("party", "dungeon", "hex");
    private static final Set<String> MOVEMENT_CAPABILITIES = Set.of(
            "features.party.api.PartyApi",
            "features.party.api.MovePartyCharactersCommand",
            "features.dungeon.api.travel.DungeonTravelApi",
            "features.dungeon.api.DungeonCellRef",
            "features.dungeon.api.DungeonTravelActionId",
            "features.hex.api.HexTravelApi",
            "features.hex.api.MoveHexPartyTokenCommand");
    private static final Set<String> REMOVED_HEX_TRAVEL_STATE_TYPES = Set.of(
            "TravelStateContribution",
            "TravelStateView",
            "TravelStateViewModel");
    private static final Set<String> FORBIDDEN_DUNGEON_TRAVEL_TYPES = Set.of(
            "DungeonMap",
            "DungeonMapRepository",
            "SqliteDungeonMapRepository",
            "DungeonMapReader",
            "DungeonMapReadService",
            "DungeonAuthoredApplicationService");
    private static final Pattern GLOBAL_TRAVEL_KEY = Pattern.compile(
            "new\\s+ContributionKey\\s*\\(\\s*\"travel\"\\s*\\)");
    private static final Path GLOBAL_TRAVEL_KEY_OWNER =
            Path.of("features/travel/adapter/javafx/TravelStateContribution.java");

    private TravelContextArchitectureTest() {
    }

    @ArchTest
    static final ArchRule travelApplicationConsumesForeignFeaturesOnlyThroughApis =
            classes()
                    .that().resideInAPackage(TRAVEL_APPLICATION)
                    .should(useOnlyForeignFeatureApis())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule travelOwnsNoSQLiteOrPersistenceAdapter =
            classes()
                    .that().resideInAPackage(TRAVEL_ROOT)
                    .should().resideOutsideOfPackage("features.travel.adapter.sqlite..")
                    .andShould().resideOutsideOfPackage("features.travel.adapter.persistence..")
                    .andShould().resideOutsideOfPackage("features.travel.persistence..")
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule travelDoesNotUsePersistenceMechanisms =
            noClasses()
                    .that().resideInAPackage(TRAVEL_ROOT)
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "platform.persistence..",
                            "java.sql..",
                            "javax.sql..",
                            "org.sqlite..");

    @ArchTest
    static final ArchRule travelOwnsNoMovementCommands =
            classes()
                    .that().resideInAPackage(TRAVEL_ROOT)
                    .should(ownNoMovementSemantics())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule dungeonAndHexOwnNoGlobalStateTab =
            noClasses()
                    .that().resideInAnyPackage("features.dungeon..", "features.hex..")
                    .should().dependOnClassesThat().haveFullyQualifiedName(SHELL_STATE_TAB_SPEC);

    @ArchTest
    static final ArchRule neutralTravelContributionOwnsTheGlobalStateTab =
            classes()
                    .that().haveFullyQualifiedName(TRAVEL_CONTRIBUTION)
                    .should().dependOnClassesThat().haveFullyQualifiedName(SHELL_STATE_TAB_SPEC)
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule noOtherTravelClassOwnsAStateTab =
            classes()
                    .that().resideInAPackage(TRAVEL_ROOT)
                    .should(onlyContributionMayUseStateTabSpec())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule removedHexTravelStateFamilyCannotReturn =
            classes()
                    .that().resideInAPackage("features.hex..")
                    .should(notHaveSimpleNames(REMOVED_HEX_TRAVEL_STATE_TYPES))
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule dungeonActionExecutionUsesStableTypedIdentity =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .should(useTypedDungeonActionExecution())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule dungeonContainsNoRowIndexedActionPath =
            classes()
                    .that().resideInAPackage("features.dungeon..")
                    .should(ownNoRowIndexedActionPath())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule dungeonTravelUsesNoWholeMapOrAuthoredFacade =
            classes()
                    .that().resideInAPackage("features.dungeon.application.travel..")
                    .should(notDependOnTypesNamed(FORBIDDEN_DUNGEON_TRAVEL_TYPES))
                    .allowEmptyShould(false);

    @Test
    void exactlyTheNeutralTravelAdapterOwnsTheGlobalTravelContributionKey() throws Exception {
        List<Path> owners = new ArrayList<>();
        try (var sources = Files.walk(Path.of("features"))) {
            for (Path source : sources.filter(TravelContextArchitectureTest::isJavaSource).toList()) {
                if (GLOBAL_TRAVEL_KEY.matcher(Files.readString(source)).find()) {
                    owners.add(source.normalize());
                }
            }
        }
        assertEquals(List.of(GLOBAL_TRAVEL_KEY_OWNER), owners);
    }

    private static ArchCondition<JavaClass> useOnlyForeignFeatureApis() {
        return new ArchCondition<>("use Party, Dungeon, and Hex only through their api packages") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    String packageName = dependency.getTargetClass().getPackageName();
                    String feature = featureName(packageName);
                    if (FOREIGN_FEATURES.contains(feature)
                            && !packageName.equals("features." + feature + ".api")
                            && !packageName.startsWith("features." + feature + ".api.")) {
                        events.add(SimpleConditionEvent.violated(
                                dependency,
                                item.getName() + " reaches foreign implementation "
                                        + dependency.getTargetClass().getName()));
                    }
                }
            }
        };
    }

    private static ArchCondition<JavaClass> ownNoMovementSemantics() {
        return new ArchCondition<>("own no movement command types, methods, or capability dependencies") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (item.getSimpleName().endsWith("Command")) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " is a command in the read-only Travel feature"));
                }
                item.getMethods().stream()
                        .filter(method -> Set.of("move", "moveTo", "performAction", "dispatch")
                                .contains(method.getName()))
                        .forEach(method -> events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " adds command semantics to Travel")));
                item.getDirectDependenciesFromSelf().stream()
                        .filter(dependency -> MOVEMENT_CAPABILITIES.contains(
                                dependency.getTargetClass().getName()))
                        .forEach(dependency -> events.add(SimpleConditionEvent.violated(
                                dependency,
                                item.getName() + " depends on movement capability "
                                        + dependency.getTargetClass().getName())));
            }
        };
    }

    private static ArchCondition<JavaClass> onlyContributionMayUseStateTabSpec() {
        return new ArchCondition<>("use ShellStateTabSpec only in " + TRAVEL_CONTRIBUTION) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (item.getName().equals(TRAVEL_CONTRIBUTION)) {
                    return;
                }
                item.getDirectDependenciesFromSelf().stream()
                        .filter(dependency -> dependency.getTargetClass().getName().equals(SHELL_STATE_TAB_SPEC))
                        .forEach(dependency -> events.add(SimpleConditionEvent.violated(
                                dependency, item.getName() + " duplicates global Travel tab ownership")));
            }
        };
    }

    private static ArchCondition<JavaClass> notHaveSimpleNames(Set<String> forbiddenNames) {
        return new ArchCondition<>("not restore removed Hex travel-state types " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (forbiddenNames.contains(item.getSimpleName())) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " restores removed Hex global state ownership"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> useTypedDungeonActionExecution() {
        return new ArchCondition<>("declare every performAction with DungeonTravelActionId") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getMethods().stream()
                        .filter(method -> method.getName().equals("performAction"))
                        .filter(method -> !hasOnlyParameter(method, DUNGEON_ACTION_ID))
                        .forEach(method -> events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " does not use stable action identity")));
            }
        };
    }

    private static ArchCondition<JavaClass> ownNoRowIndexedActionPath() {
        return new ArchCondition<>("contain no SelectedAction or selected-action row index carrier") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                if (item.getSimpleName().equals("SelectedAction")) {
                    events.add(SimpleConditionEvent.violated(
                            item, item.getName() + " restores the removed row-index action carrier"));
                }
                item.getMethods().stream()
                        .filter(method -> method.getName().equals("selectedActionRowIndex"))
                        .forEach(method -> events.add(SimpleConditionEvent.violated(
                                method, method.getDescription() + " restores row-index action addressing")));
                item.getFields().stream()
                        .filter(field -> field.getName().equals("selectedActionRowIndex"))
                        .forEach(field -> events.add(SimpleConditionEvent.violated(
                                field, field.getDescription() + " restores row-index action addressing")));
            }
        };
    }

    private static ArchCondition<JavaClass> notDependOnTypesNamed(Set<String> forbiddenNames) {
        return new ArchCondition<>("avoid whole-map and Authored-facade types " + forbiddenNames) {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getDirectDependenciesFromSelf().stream()
                        .filter(dependency -> forbiddenNames.contains(
                                dependency.getTargetClass().getSimpleName()))
                        .forEach(dependency -> events.add(SimpleConditionEvent.violated(
                                dependency,
                                item.getName() + " depends on forbidden travel read type "
                                        + dependency.getTargetClass().getName())));
            }
        };
    }

    private static boolean hasOnlyParameter(JavaMethod method, String expectedType) {
        return method.getRawParameterTypes().size() == 1
                && method.getRawParameterTypes().getFirst().getName().equals(expectedType);
    }

    private static String featureName(String packageName) {
        String[] segments = packageName.split("\\.");
        return segments.length > 1 && segments[0].equals("features") ? segments[1] : "";
    }

    private static boolean isJavaSource(Path path) {
        return Files.isRegularFile(path) && path.getFileName().toString().endsWith(".java");
    }
}
