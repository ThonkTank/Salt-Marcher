package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;

@BugPattern(
        name = "DomainFactoryRoleShape",
        summary = "Domain factory role packages must use the declared tactical type shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainFactoryRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_FACTORY_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.factory$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_FACTORY_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        if (typeElement.getKind() == ElementKind.CLASS
                && typeElement.getModifiers().contains(Modifier.FINAL)) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Domain factory type '" + typeElement.getQualifiedName()
                        + "' violates factory/ shape: factory role types must be final classes.")
                .build();
    }
}
