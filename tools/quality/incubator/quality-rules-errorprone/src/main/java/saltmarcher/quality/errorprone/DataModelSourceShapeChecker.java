package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.RecordComponentElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DataModelSourceShape",
        summary = "Data model packages must expose only source-local carriers or schema utility types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataModelSourceShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        Matcher modelMatcher = DataArchitectureSupport.MODEL_PACKAGE.matcher(packageName);
        if (!modelMatcher.matches()) {
            return Description.NO_MATCH;
        }

        String featureName = modelMatcher.group(1);
        if ("persistencecore".equals(featureName)) {
            return Description.NO_MATCH;
        }
        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !isPublicOrProtected(typeElement)) {
            return Description.NO_MATCH;
        }

        List<String> violations = new ArrayList<>();
        collectPublicSignatureViolations(typeElement, featureName, isSchemaUtility(typeElement), violations);
        if (!isAllowedModelShape(typeElement, violations) || !violations.isEmpty()) {
            return buildDescription(tree)
                    .setMessage("Data model type '" + typeElement.getQualifiedName()
                            + "' must be a source-local record, enum, immutable final carrier, or final schema utility. "
                            + String.join("; ", violations))
                    .build();
        }

        return Description.NO_MATCH;
    }

    private static boolean isAllowedModelShape(TypeElement typeElement, List<String> violations) {
        if (typeElement.getKind() == ElementKind.RECORD || typeElement.getKind() == ElementKind.ENUM) {
            return true;
        }
        if (!typeElement.getModifiers().contains(Modifier.FINAL)) {
            violations.add("public model classes must be final unless they are records or enums");
            return false;
        }
        if (isSchemaUtility(typeElement)) {
            return true;
        }
        return isImmutableCarrier(typeElement, violations);
    }

    private static boolean isSchemaUtility(TypeElement typeElement) {
        return typeElement.getSimpleName().toString().endsWith("PersistenceSchema");
    }

    private static boolean isImmutableCarrier(TypeElement typeElement, List<String> violations) {
        boolean valid = true;
        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (field.getModifiers().contains(Modifier.STATIC)) {
                continue;
            }
            Set<Modifier> modifiers = field.getModifiers();
            if (!modifiers.contains(Modifier.PRIVATE) || !modifiers.contains(Modifier.FINAL)) {
                violations.add("instance field " + field.getSimpleName() + " must be private final");
                valid = false;
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (!isPublicOrProtected(method) || method.getModifiers().contains(Modifier.STATIC)) {
                continue;
            }
            if (!method.getParameters().isEmpty() || "void".equals(method.getReturnType().toString())) {
                violations.add("public carrier method " + method.getSimpleName()
                        + " must be a parameterless value accessor");
                valid = false;
            }
        }
        return valid;
    }

    private static void collectPublicSignatureViolations(
            TypeElement typeElement,
            String featureName,
            boolean schemaUtility,
            List<String> violations
    ) {
        collectTypeViolations("extends", typeElement.getSuperclass(), featureName, schemaUtility, violations);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectTypeViolations("implements", implementedInterface, featureName, schemaUtility, violations);
        }
        for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeViolations("type bound of " + typeParameter.getSimpleName(), bound, featureName, schemaUtility, violations);
            }
        }
        if (typeElement.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                collectTypeViolations(
                        "record component " + recordComponent.getSimpleName(),
                        recordComponent.asType(),
                        featureName,
                        schemaUtility,
                        violations);
            }
        }

        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(field)) {
                collectTypeViolations("field " + field.getSimpleName(), field.asType(), featureName, schemaUtility, violations);
            }
        }
        for (ExecutableElement constructor : ElementFilter.constructorsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(constructor)) {
                collectExecutableViolations("constructor " + typeElement.getSimpleName(), constructor, featureName, schemaUtility, violations);
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(method)) {
                collectExecutableViolations(String.valueOf(method.getSimpleName()), method, featureName, schemaUtility, violations);
            }
        }
    }

    private static void collectExecutableViolations(
            String executableName,
            ExecutableElement executable,
            String featureName,
            boolean schemaUtility,
            List<String> violations
    ) {
        collectTypeViolations("return type of " + executableName, executable.getReturnType(), featureName, schemaUtility, violations);
        for (VariableElement parameter : executable.getParameters()) {
            collectTypeViolations(
                    "parameter " + parameter.getSimpleName() + " of " + executableName,
                    parameter.asType(),
                    featureName,
                    schemaUtility,
                    violations);
        }
        for (TypeMirror thrownType : executable.getThrownTypes()) {
            collectTypeViolations("throws clause of " + executableName, thrownType, featureName, schemaUtility, violations);
        }
        for (TypeParameterElement typeParameter : executable.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeViolations(
                        "type bound of " + typeParameter.getSimpleName() + " in " + executableName,
                        bound,
                        featureName,
                        schemaUtility,
                        violations);
            }
        }
    }

    private static void collectTypeViolations(
            String position,
            TypeMirror typeMirror,
            String featureName,
            boolean schemaUtility,
            List<String> violations
    ) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        DataArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        for (String referencedType : referencedTypes) {
            if (!isAllowedModelSignatureType(referencedType, featureName, schemaUtility)) {
                violations.add(position + " -> " + referencedType);
            }
        }
    }

    private static boolean isAllowedModelSignatureType(String referencedType, String featureName, boolean schemaUtility) {
        if (referencedType.startsWith("src.data." + featureName + ".model.")) {
            return true;
        }
        if (schemaUtility && referencedType.startsWith("src.data.persistencecore.model.")) {
            return true;
        }
        if (referencedType.startsWith("java.lang.")) {
            return true;
        }
        return referencedType.startsWith("java.util.");
    }

    private static boolean isPublicOrProtected(Element element) {
        return element.getModifiers().contains(Modifier.PUBLIC)
                || element.getModifiers().contains(Modifier.PROTECTED);
    }
}
