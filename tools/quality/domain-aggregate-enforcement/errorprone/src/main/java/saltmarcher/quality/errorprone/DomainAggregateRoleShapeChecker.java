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
        name = "DomainAggregateRoleShape",
        summary = "Domain aggregate role packages must use aggregate root type shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainAggregateRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_AGGREGATE_PACKAGE = Pattern.compile(
            "^src\\.domain\\.[^.]+\\.[^.]+\\.aggregate$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_AGGREGATE_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        ElementKind kind = typeElement.getKind();
        if (kind != ElementKind.CLASS && kind != ElementKind.RECORD) {
            return buildDescription(tree)
                    .setMessage("Domain aggregate type '" + typeElement.getQualifiedName()
                            + "' violates aggregate/ shape: aggregate roots must be classes or records.")
                    .build();
        }
        if (kind == ElementKind.CLASS && !typeElement.getModifiers().contains(Modifier.FINAL)) {
            return buildDescription(tree)
                    .setMessage("Domain aggregate type '" + typeElement.getQualifiedName()
                            + "' violates aggregate/ shape: aggregate root classes must be final.")
                    .build();
        }
        return Description.NO_MATCH;
    }
}
