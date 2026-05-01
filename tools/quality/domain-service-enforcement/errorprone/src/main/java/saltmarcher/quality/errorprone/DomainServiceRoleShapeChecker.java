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
        name = "DomainServiceRoleShape",
        summary = "Domain service role packages must use the declared tactical type shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainServiceRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_SERVICE_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.service$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_SERVICE_PACKAGE.matcher(packageName).matches()) {
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
                .setMessage("Domain service type '" + typeElement.getQualifiedName()
                        + "' violates service/ shape: service role types must be final classes.")
                .build();
    }
}
