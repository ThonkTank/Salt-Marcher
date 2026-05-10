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
        name = "DataQueryPublicSignatureBoundary",
        summary = "Query adapter signatures must not leak source-local model or source-adapter types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataQueryPublicSignatureBoundaryChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DataArchitectureSupport.QUERY_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }

        List<String> leaks = new ArrayList<>();
        collectTypeLeak("extends", typeElement.getSuperclass(), leaks);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectTypeLeak("implements", implementedInterface, leaks);
        }
        for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName(), bound, leaks);
            }
        }
        if (typeElement.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                collectTypeLeak("record component " + recordComponent.getSimpleName(), recordComponent.asType(), leaks);
            }
        }

        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (field.getModifiers().contains(Modifier.PUBLIC) || field.getModifiers().contains(Modifier.PROTECTED)) {
                collectTypeLeak("field " + field.getSimpleName(), field.asType(), leaks);
            }
        }
        for (ExecutableElement constructor : ElementFilter.constructorsIn(typeElement.getEnclosedElements())) {
            if (constructor.getModifiers().contains(Modifier.PUBLIC)
                    || constructor.getModifiers().contains(Modifier.PROTECTED)) {
                collectExecutableLeaks("constructor " + typeElement.getSimpleName(), constructor, leaks);
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (method.getModifiers().contains(Modifier.PUBLIC) || method.getModifiers().contains(Modifier.PROTECTED)) {
                collectExecutableLeaks(String.valueOf(method.getSimpleName()), method, leaks);
            }
        }
        collectInheritedMethodLeaks(typeElement, typeElement, leaks, new LinkedHashSet<>());

        if (leaks.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Public query adapter type '" + tree.getSimpleName()
                        + "' leaks internal data-layer source types: " + String.join("; ", leaks))
                .build();
    }

    private static void collectExecutableLeaks(String executableName, ExecutableElement executable, List<String> leaks) {
        collectTypeLeak("return type of " + executableName, executable.getReturnType(), leaks);
        for (VariableElement parameter : executable.getParameters()) {
            collectTypeLeak("parameter " + parameter.getSimpleName() + " of " + executableName, parameter.asType(), leaks);
        }
        for (TypeMirror thrownType : executable.getThrownTypes()) {
            collectTypeLeak("throws clause of " + executableName, thrownType, leaks);
        }
        for (TypeParameterElement typeParameter : executable.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName() + " in " + executableName, bound, leaks);
            }
        }
        collectTypeLeak("executable signature of " + executableName, executable.asType(), leaks);
    }

    private static void collectInheritedMethodLeaks(
            TypeElement ownerType,
            TypeElement currentType,
            List<String> leaks,
            Set<String> visitedTypes
    ) {
        String qualifiedName = currentType.getQualifiedName().toString();
        if (!visitedTypes.add(qualifiedName) || "java.lang.Object".equals(qualifiedName)) {
            return;
        }
        if (!currentType.equals(ownerType)) {
            for (ExecutableElement method : ElementFilter.methodsIn(currentType.getEnclosedElements())) {
                if ((method.getModifiers().contains(Modifier.PUBLIC)
                        || method.getModifiers().contains(Modifier.PROTECTED))
                        && !method.getModifiers().contains(Modifier.STATIC)) {
                    collectExecutableLeaks(
                            method.getSimpleName() + " inherited from " + currentType.getQualifiedName(),
                            method,
                            leaks);
                }
            }
        }
        TypeMirror superclass = currentType.getSuperclass();
        if (superclass instanceof javax.lang.model.type.DeclaredType declaredType
                && declaredType.asElement() instanceof TypeElement superclassElement) {
            collectInheritedMethodLeaks(ownerType, superclassElement, leaks, visitedTypes);
        }
    }

    private static void collectTypeLeak(String position, TypeMirror typeMirror, List<String> leaks) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        DataArchitectureSupport.collectTypeReferences(typeMirror, referencedTypes);
        for (String referencedType : referencedTypes) {
            if (DataArchitectureSupport.isInternalDataLeak(referencedType)) {
                leaks.add(position + " -> " + referencedType);
            }
        }
    }
}
