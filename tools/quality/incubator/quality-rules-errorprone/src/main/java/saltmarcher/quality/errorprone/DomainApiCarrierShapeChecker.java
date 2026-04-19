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
        name = "DomainApiCarrierShape",
        summary = "Public domain api types must remain boundary carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainApiCarrierShapeChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_API_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.api(\\..*)?$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_API_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }
        if (isAllowedCarrierShape(typeElement)) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Public domain api type '" + typeElement.getQualifiedName()
                        + "' must be a record, enum, or sealed abstraction so api/ remains a boundary-carrier surface.")
                .build();
    }

    private static boolean isAllowedCarrierShape(TypeElement typeElement) {
        ElementKind kind = typeElement.getKind();
        if (kind == ElementKind.RECORD || kind == ElementKind.ENUM) {
            return true;
        }
        if (kind == ElementKind.INTERFACE || kind == ElementKind.CLASS) {
            return typeElement.getModifiers().contains(Modifier.SEALED);
        }
        return true;
    }
}
