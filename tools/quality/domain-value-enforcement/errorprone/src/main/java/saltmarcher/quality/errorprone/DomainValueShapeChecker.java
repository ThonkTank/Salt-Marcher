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
        name = "DomainValueShape",
        summary = "Domain value role packages must use immutable value type shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainValueShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_VALUE_PACKAGE = Pattern.compile(
            "^src\\.domain\\.[^.]+\\.[^.]+\\.value$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_VALUE_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        String violation = valueViolation(typeElement);
        if (violation == null) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain value type '" + typeElement.getQualifiedName()
                        + "' violates value/ shape: " + violation)
                .build();
    }

    private static String valueViolation(TypeElement typeElement) {
        ElementKind kind = typeElement.getKind();
        if (kind == ElementKind.RECORD || kind == ElementKind.ENUM) {
            return null;
        }
        if ((kind == ElementKind.CLASS || kind == ElementKind.INTERFACE)
                && typeElement.getModifiers().contains(Modifier.SEALED)) {
            return null;
        }
        if (kind != ElementKind.CLASS || !typeElement.getModifiers().contains(Modifier.FINAL)) {
            return "values must be records, enums, sealed abstractions, or final immutable classes.";
        }

        List<String> mutableFields = new ArrayList<>();
        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (!field.getModifiers().contains(Modifier.STATIC)
                    && (!field.getModifiers().contains(Modifier.PRIVATE)
                    || !field.getModifiers().contains(Modifier.FINAL))) {
                mutableFields.add(field.getSimpleName().toString());
            }
        }
        if (!mutableFields.isEmpty()) {
            return "final value classes must expose only private final instance state. Mutable/non-private fields: "
                    + String.join(", ", mutableFields) + ".";
        }
        return null;
    }
}
