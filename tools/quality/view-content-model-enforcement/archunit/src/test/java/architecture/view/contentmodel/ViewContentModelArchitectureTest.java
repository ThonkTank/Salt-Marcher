package architecture.view.contentmodel;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import architecture.AnalyzeMainClasses;
import architecture.view.ViewRolePredicates;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeMainClasses
public final class ViewContentModelArchitectureTest {

    private ViewContentModelArchitectureTest() {
    }

    @ArchTest
    static final ArchRule contentModelsMustStayShellDataAndServiceFree =
            noClasses()
                    .that(ViewRolePredicates.areContentModels())
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("shell..", "src.data..", "bootstrap..");

    @ArchTest
    static final ArchRule contentModelsMustNotDependOnApplicationServices =
            noClasses()
                    .that(ViewRolePredicates.areContentModels())
                    .should()
                    .dependOnClassesThat()
                    .haveSimpleNameEndingWith("ApplicationService");
}
