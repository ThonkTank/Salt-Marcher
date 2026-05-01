package architecture.data.persistencecore;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

@AnalyzeMainClasses
public final class DataPersistencecoreArchitectureTest {

    private DataPersistencecoreArchitectureTest() {
    }

    @ArchTest
    static final ArchRule persistencecoreMustStayIndependentFromFeatureSpecificDataPackages =
            classes()
                    .that()
                    .resideInAPackage("src.data.persistencecore..")
                    .should(notDependOnFeatureSpecificDataPackages());

    @ArchTest
    static final ArchRule persistencecoreMustNotDependOnDomainTypes =
            noClasses()
                    .that()
                    .resideInAPackage("src.data.persistencecore..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("src.domain..");

    private static ArchCondition<JavaClass> notDependOnFeatureSpecificDataPackages() {
        return new ArchCondition<>("not depend on feature-specific data packages") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetPackage = target.getPackageName();
                    if (targetPackage.startsWith("src.data.persistencecore.")
                            || !targetPackage.startsWith("src.data.")) {
                        continue;
                    }
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " depends on feature-specific data package " + target.getName()));
                }
            }
        };
    }
}
