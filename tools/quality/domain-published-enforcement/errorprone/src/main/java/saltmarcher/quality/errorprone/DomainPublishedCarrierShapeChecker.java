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
        name = "DomainPublishedCarrierShape",
        summary = "Public domain published types must remain boundary carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublishedCarrierShapeChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_PUBLISHED_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.published(\\..*)?$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_PUBLISHED_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null) {
            return Description.NO_MATCH;
        }
        if (!typeElement.getNestingKind().isNested()
                && !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return buildDescription(tree)
                    .setMessage("Top-level domain published type '" + typeElement.getQualifiedName()
                            + "' must be public so published/ exposes an explicit boundary carrier surface.")
                    .build();
        }
        if (!typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }
        if (isAllowedCarrierShape(typeElement)) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Public domain published type '" + typeElement.getQualifiedName()
                        + "' must be a record, enum, or sealed abstraction so published/ remains a boundary-carrier surface.")
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
