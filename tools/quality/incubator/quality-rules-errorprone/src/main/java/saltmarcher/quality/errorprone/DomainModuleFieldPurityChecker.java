package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DomainModuleFieldPurity",
        summary = "Public concrete named-module domain types must not expose mutable fields.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainModuleFieldPurityChecker extends BugChecker
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
        if (typeElement == null
                || !typeElement.getModifiers().contains(Modifier.PUBLIC)
                || typeElement.getKind() == ElementKind.INTERFACE
                || typeElement.getKind() == ElementKind.ENUM) {
            return Description.NO_MATCH;
        }

        List<String> mutableFields = new ArrayList<>();
        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (isMutableInstanceField(field) || isMutablePublicStaticField(field)) {
                mutableFields.add(field.getSimpleName().toString());
            }
        }

        if (mutableFields.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Public named-module domain type '" + typeElement.getQualifiedName()
                        + "' exposes mutable field(s): " + String.join(", ", mutableFields)
                        + ". Domain model state must be private/final instance state or immutable record state.")
                .build();
    }

    private static boolean isMutableInstanceField(VariableElement field) {
        return !field.getModifiers().contains(Modifier.STATIC)
                && !field.getModifiers().contains(Modifier.FINAL);
    }

    private static boolean isMutablePublicStaticField(VariableElement field) {
        return field.getModifiers().contains(Modifier.PUBLIC)
                && field.getModifiers().contains(Modifier.STATIC)
                && !field.getModifiers().contains(Modifier.FINAL);
    }
}
