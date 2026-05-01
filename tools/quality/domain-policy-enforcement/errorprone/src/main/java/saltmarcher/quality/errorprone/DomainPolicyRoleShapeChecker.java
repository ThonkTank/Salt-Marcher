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
        name = "DomainPolicyRoleShape",
        summary = "Domain policy role packages must use final class tactical shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPolicyRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_POLICY_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.policy$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_POLICY_PACKAGE.matcher(packageName).matches()) {
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
                .setMessage("Domain policy type '" + typeElement.getQualifiedName()
                        + "' violates policy/ shape: policy role types must be final classes.")
                .build();
    }
}
