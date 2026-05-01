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
        name = "DataGatewayReturnTypeBoundary",
        summary = "Source-adapter packages must not expose domain or exported backend types in public signatures.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataGatewayReturnTypeBoundaryChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DataArchitectureSupport.GATEWAY_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }
        String featureName = featureName(packageName);
        if (featureName == null) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null) {
            return Description.NO_MATCH;
        }
        if (!isPublicOrProtected(typeElement)) {
            return Description.NO_MATCH;
        }

        List<String> violations = new ArrayList<>();
        collectTypeViolation("extends", typeElement.getSuperclass(), featureName, violations);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectTypeViolation("implements", implementedInterface, featureName, violations);
        }
        for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeViolation("type bound of " + typeParameter.getSimpleName(), bound, featureName, violations);
            }
        }
        if (typeElement.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                collectTypeViolation(
                        "record component " + recordComponent.getSimpleName(),
                        recordComponent.asType(),
                        featureName,
                        violations);
            }
        }

        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(field)) {
                collectTypeViolation("field " + field.getSimpleName(), field.asType(), featureName, violations);
            }
        }
        for (ExecutableElement constructor : ElementFilter.constructorsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(constructor)) {
                collectExecutableViolations("constructor " + typeElement.getSimpleName(), constructor, featureName, violations);
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (!isPublicOrProtected(method)) {
                continue;
            }
            collectExecutableViolations(String.valueOf(method.getSimpleName()), method, featureName, violations);
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Source-adapter package '" + packageName
                        + "' exposes public/protected signature types outside source-local data records or JDK value/container types: "
                        + String.join("; ", violations))
                .build();
    }

    private static String featureName(String packageName) {
        Matcher matcher = DataArchitectureSupport.GATEWAY_PACKAGE.matcher(packageName);
        return matcher.matches() ? matcher.group(1) : null;
    }

    private static void collectExecutableViolations(
            String executableName,
            ExecutableElement executable,
            String featureName,
            List<String> violations
    ) {
        collectTypeViolation("return type of " + executableName, executable.getReturnType(), featureName, violations);
        for (VariableElement parameter : executable.getParameters()) {
            collectTypeViolation(
                    "parameter " + parameter.getSimpleName() + " of " + executableName,
                    parameter.asType(),
                    featureName,
                    violations);
        }
        for (TypeMirror thrownType : executable.getThrownTypes()) {
            collectTypeViolation("throws clause of " + executableName, thrownType, featureName, violations);
        }
        for (TypeParameterElement typeParameter : executable.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeViolation(
                        "type bound of " + typeParameter.getSimpleName() + " in " + executableName,
                        bound,
                        featureName,
                        violations);
            }
        }
    }

    private static boolean isPublicOrProtected(javax.lang.model.element.Element element) {
        return element.getModifiers().contains(Modifier.PUBLIC)
                || element.getModifiers().contains(Modifier.PROTECTED);
    }

    private static void collectTypeViolation(
            String position,
            TypeMirror typeMirror,
            String featureName,
            List<String> violations
    ) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        DataArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        for (String referencedType : referencedTypes) {
            if (!isAllowedGatewaySignatureType(referencedType, featureName)) {
                violations.add(position + " -> " + referencedType);
            }
        }
    }

    private static boolean isAllowedGatewaySignatureType(String referencedType, String featureName) {
        if (referencedType.startsWith("src.data." + featureName + ".model.")) {
            return true;
        }
        if (referencedType.startsWith("java.lang.")) {
            return true;
        }
        return referencedType.startsWith("java.util.");
    }
}
