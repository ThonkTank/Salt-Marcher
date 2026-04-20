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
        name = "DomainRoleShape",
        summary = "Domain role packages must use the declared hexagonal core type shapes.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_ROLE_PACKAGE = Pattern.compile(
            "^src\\.domain\\.[^.]+\\.[^.]+\\.(aggregate|entity|value|policy|port|factory|service|event|specification)$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        var matcher = DOMAIN_ROLE_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        String role = matcher.group(1);
        String violation = switch (role) {
            case "aggregate" -> aggregateViolation(typeElement);
            case "entity" -> entityViolation(typeElement);
            case "value" -> valueViolation(typeElement);
            case "port" -> portViolation(typeElement);
            case "policy" -> statelessRoleViolation(typeElement, "Policy");
            case "factory" -> statelessRoleViolation(typeElement, "Factory");
            case "service" -> statelessRoleViolation(typeElement, "Service");
            case "event" -> eventViolation(typeElement);
            case "specification" -> specificationViolation(typeElement);
            default -> null;
        };

        if (violation == null) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain role type '" + typeElement.getQualifiedName()
                        + "' violates " + role + "/ shape: " + violation)
                .build();
    }

    private static String aggregateViolation(TypeElement typeElement) {
        ElementKind kind = typeElement.getKind();
        if (kind != ElementKind.CLASS && kind != ElementKind.RECORD) {
            return "aggregate roots must be classes or records.";
        }
        if (kind == ElementKind.CLASS && !typeElement.getModifiers().contains(Modifier.FINAL)) {
            return "aggregate root classes must be final.";
        }
        return null;
    }

    private static String entityViolation(TypeElement typeElement) {
        ElementKind kind = typeElement.getKind();
        if (kind == ElementKind.RECORD || typeElement.getModifiers().contains(Modifier.SEALED)) {
            return null;
        }
        if (kind != ElementKind.CLASS || !typeElement.getModifiers().contains(Modifier.FINAL)) {
            return "entities must be records, sealed abstractions, or final classes.";
        }
        return null;
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

    private static String portViolation(TypeElement typeElement) {
        String simpleName = typeElement.getSimpleName().toString();
        if (typeElement.getKind() != ElementKind.INTERFACE
                || !(simpleName.endsWith("Repository")
                || simpleName.endsWith("Lookup")
                || simpleName.endsWith("Catalog")
                || simpleName.endsWith("Search"))) {
            return "ports must be interfaces ending Repository, Lookup, Catalog, or Search.";
        }
        return null;
    }

    private static String statelessRoleViolation(TypeElement typeElement, String suffix) {
        if (typeElement.getKind() != ElementKind.CLASS
                || !typeElement.getModifiers().contains(Modifier.FINAL)) {
            return suffix.toLowerCase() + " role types must be final classes.";
        }

        List<String> instanceFields = new ArrayList<>();
        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (!field.getModifiers().contains(Modifier.STATIC)) {
                instanceFields.add(field.getSimpleName().toString());
            }
        }
        if (!instanceFields.isEmpty()) {
            return suffix.toLowerCase() + " role types must be stateless. Instance fields: "
                    + String.join(", ", instanceFields) + ".";
        }
        return null;
    }

    private static String eventViolation(TypeElement typeElement) {
        if (typeElement.getKind() != ElementKind.RECORD
                || !typeElement.getSimpleName().toString().endsWith("Event")) {
            return "events must be records ending Event.";
        }
        return null;
    }

    private static String specificationViolation(TypeElement typeElement) {
        String simpleName = typeElement.getSimpleName().toString();
        boolean allowedKind = typeElement.getKind() == ElementKind.INTERFACE
                || (typeElement.getKind() == ElementKind.CLASS
                && typeElement.getModifiers().contains(Modifier.FINAL));
        if (!allowedKind || !simpleName.endsWith("Specification")) {
            return "specifications must be final classes or interfaces ending Specification.";
        }
        return null;
    }
}
