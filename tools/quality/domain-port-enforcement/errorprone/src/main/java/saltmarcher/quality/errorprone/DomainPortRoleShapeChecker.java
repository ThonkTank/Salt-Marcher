package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.TypeElement;

@BugPattern(
        name = "DomainPortRoleShape",
        summary = "Domain outbound ports must use the declared hexagonal port role shape.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPortRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_PORT_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.port$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_PORT_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        String simpleName = typeElement.getSimpleName().toString();
        if (typeElement.getKind() == ElementKind.INTERFACE
                && (simpleName.endsWith("Repository")
                || simpleName.endsWith("Lookup")
                || simpleName.endsWith("Catalog")
                || simpleName.endsWith("Search"))) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Domain port type '" + typeElement.getQualifiedName()
                        + "' violates port/ shape: ports must be interfaces ending Repository, Lookup, Catalog, or Search.")
                .build();
    }
}
