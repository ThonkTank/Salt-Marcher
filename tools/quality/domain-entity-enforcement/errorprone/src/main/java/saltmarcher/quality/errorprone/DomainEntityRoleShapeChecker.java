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
        name = "DomainEntityRoleShape",
        summary = "Domain entity role packages must use entity type shapes with identity semantics.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainEntityRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_ENTITY_PACKAGE = Pattern.compile(
            "^src\\.domain\\.[^.]+\\.[^.]+\\.entity$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_ENTITY_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        ElementKind kind = typeElement.getKind();
        if (kind == ElementKind.RECORD || typeElement.getModifiers().contains(Modifier.SEALED)) {
            return Description.NO_MATCH;
        }
        if (kind == ElementKind.CLASS && typeElement.getModifiers().contains(Modifier.FINAL)) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Domain entity type '" + typeElement.getQualifiedName()
                        + "' violates entity/ shape: entities must be records, sealed abstractions, or final classes.")
                .build();
    }
}
