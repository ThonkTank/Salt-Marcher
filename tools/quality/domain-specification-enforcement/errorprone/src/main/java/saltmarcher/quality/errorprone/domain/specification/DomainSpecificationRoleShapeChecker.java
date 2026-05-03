package saltmarcher.quality.errorprone.domain.specification;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;

@BugPattern(
        name = "DomainSpecificationRoleShape",
        summary = "Domain specification role packages must use the declared tactical type shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainSpecificationRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_SPECIFICATION_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.specification$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_SPECIFICATION_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        String simpleName = typeElement.getSimpleName().toString();
        boolean allowedKind = typeElement.getKind() == ElementKind.INTERFACE
                || (typeElement.getKind() == ElementKind.CLASS
                && typeElement.getModifiers().contains(Modifier.FINAL));
        if (allowedKind && simpleName.endsWith("Specification")) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Domain specification type '" + typeElement.getQualifiedName()
                        + "' violates specification/ shape: specifications must be final classes or interfaces "
                        + "ending Specification.")
                .build();
    }

    private static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }
}
