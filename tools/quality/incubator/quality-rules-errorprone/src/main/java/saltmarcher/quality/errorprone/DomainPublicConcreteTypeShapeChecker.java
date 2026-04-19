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
        name = "DomainPublicConcreteTypeShape",
        summary = "Public concrete named-module domain types must be records, enums, final classes, or sealed abstractions.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublicConcreteTypeShapeChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern NAMED_DOMAIN_MODULE_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.((?!api$|application$)[^.]+)(\\..*)?$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = state.getPath().getCompilationUnit().getPackageName() == null
                ? ""
                : state.getPath().getCompilationUnit().getPackageName().toString();
        if (!NAMED_DOMAIN_MODULE_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }
        if (isAllowedShape(typeElement)) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Public named-module domain type '" + typeElement.getQualifiedName()
                        + "' must be a record, enum, final class, interface, or sealed abstraction.")
                .build();
    }

    private static boolean isAllowedShape(TypeElement typeElement) {
        ElementKind kind = typeElement.getKind();
        if (kind == ElementKind.RECORD || kind == ElementKind.ENUM || kind == ElementKind.INTERFACE) {
            return true;
        }
        if (kind != ElementKind.CLASS) {
            return true;
        }
        return typeElement.getModifiers().contains(Modifier.FINAL)
                || typeElement.getModifiers().contains(Modifier.SEALED);
    }
}
