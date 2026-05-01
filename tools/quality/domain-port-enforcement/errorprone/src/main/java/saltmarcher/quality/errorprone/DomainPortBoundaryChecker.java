package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.RecordComponentElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.ErrorType;
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.NoType;
import javax.lang.model.type.NullType;
import javax.lang.model.type.PrimitiveType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.UnionType;
import javax.lang.model.type.WildcardType;
import javax.lang.model.util.ElementFilter;
import javax.lang.model.util.SimpleTypeVisitor14;

@BugPattern(
        name = "DomainPortBoundary",
        summary = "Domain outbound ports must stay abstract and free of infrastructure signatures.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPortBoundaryChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_PACKAGE = Pattern.compile("^src\\.domain\\..+");
    private static final Pattern DOMAIN_PORT_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.port$");
    private static final Pattern DOMAIN_PORT_TYPE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.port\\.[^.]+(?:Repository|Lookup|Catalog|Search)$");
    private static final Set<String> FORBIDDEN_INFRASTRUCTURE_PREFIXES = Set.of(
            "bootstrap.",
            "shell.",
            "src.view.",
            "src.data.",
            "javafx.",
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "okhttp3.",
            "retrofit2.",
            "java.io.",
            "java.nio.file.",
            "javax.transaction.",
            "jakarta.transaction.",
            "javax.persistence.",
            "jakarta.persistence.",
            "org.jooq.",
            "org.hibernate.",
            "com.zaxxer.hikari.");
    private static final Set<String> FORBIDDEN_INFRASTRUCTURE_TYPES = Set.of(
            "java.lang.AutoCloseable",
            "java.io.Closeable");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null) {
            return Description.NO_MATCH;
        }

        List<String> violations = new ArrayList<>();
        collectRepositoryPlacementViolations(typeElement, packageName, violations);
        collectPortImplementationViolations(typeElement, violations);
        if (DOMAIN_PORT_PACKAGE.matcher(packageName).matches()) {
            collectPortSignatureLeaks(typeElement, violations);
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain port boundary violation in '" + typeElement.getQualifiedName()
                        + "': " + String.join("; ", violations))
                .build();
    }

    private static void collectRepositoryPlacementViolations(
            TypeElement typeElement,
            String packageName,
            List<String> violations) {
        if (!typeElement.getSimpleName().toString().endsWith("Repository")) {
            return;
        }
        if (DOMAIN_PORT_PACKAGE.matcher(packageName).matches()
                && typeElement.getKind() == ElementKind.INTERFACE) {
            return;
        }
        violations.add("domain *Repository types must be outbound port interfaces under a named module port/ package");
    }

    private static void collectPortImplementationViolations(
            TypeElement typeElement,
            List<String> violations) {
        ElementKind kind = typeElement.getKind();
        if (kind == ElementKind.INTERFACE || kind == ElementKind.ANNOTATION_TYPE) {
            return;
        }
        List<String> implementedPorts = new ArrayList<>();
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectImplementedDomainPorts(implementedInterface, implementedPorts);
        }
        if (!implementedPorts.isEmpty()) {
            violations.add("outbound port implementations belong outside src/domain/**; implemented port(s): "
                    + String.join(", ", implementedPorts));
        }
    }

    private static void collectImplementedDomainPorts(TypeMirror typeMirror, List<String> implementedPorts) {
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof TypeElement typeElement)) {
            return;
        }
        String qualifiedName = typeElement.getQualifiedName().toString();
        if (DOMAIN_PORT_TYPE.matcher(qualifiedName).matches()) {
            implementedPorts.add(qualifiedName);
        }
        for (TypeMirror parentInterface : typeElement.getInterfaces()) {
            collectImplementedDomainPorts(parentInterface, implementedPorts);
        }
    }

    private static void collectPortSignatureLeaks(TypeElement typeElement, List<String> violations) {
        collectTypeLeak("extends", typeElement.getSuperclass(), violations);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectTypeLeak("implements", implementedInterface, violations);
        }
        for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName(), bound, violations);
            }
        }
        if (typeElement.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                collectTypeLeak("record component " + recordComponent.getSimpleName(), recordComponent.asType(), violations);
            }
        }
        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(field)) {
                collectTypeLeak("field " + field.getSimpleName(), field.asType(), violations);
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(method)) {
                collectExecutableLeaks(String.valueOf(method.getSimpleName()), method, violations);
            }
        }
        for (ExecutableElement constructor : ElementFilter.constructorsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(constructor)) {
                collectExecutableLeaks("constructor " + typeElement.getSimpleName(), constructor, violations);
            }
        }
    }

    private static boolean isPublicOrProtected(Element element) {
        return element.getModifiers().contains(Modifier.PUBLIC)
                || element.getModifiers().contains(Modifier.PROTECTED);
    }

    private static void collectExecutableLeaks(
            String executableName,
            ExecutableElement executable,
            List<String> violations) {
        collectTypeLeak("return type of " + executableName, executable.getReturnType(), violations);
        for (VariableElement parameter : executable.getParameters()) {
            collectTypeLeak("parameter " + parameter.getSimpleName() + " of " + executableName, parameter.asType(), violations);
        }
        for (TypeMirror thrownType : executable.getThrownTypes()) {
            collectTypeLeak("throws clause of " + executableName, thrownType, violations);
        }
        for (TypeParameterElement typeParameter : executable.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName() + " in " + executableName, bound, violations);
            }
        }
        TypeMirror executableType = executable.asType();
        if (executableType instanceof ExecutableType) {
            collectTypeLeak("executable signature of " + executableName, executableType, violations);
        }
    }

    private static void collectTypeLeak(String position, TypeMirror typeMirror, List<String> violations) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                addLeakIfNeeded(position, declaredType.asElement(), violations);
                for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                    typeArgument.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType arrayType, Void unused) {
                arrayType.getComponentType().accept(this, null);
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable typeVariable, Void unused) {
                typeVariable.getUpperBound().accept(this, null);
                TypeMirror lowerBound = typeVariable.getLowerBound();
                if (lowerBound != null) {
                    lowerBound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType wildcardType, Void unused) {
                if (wildcardType.getExtendsBound() != null) {
                    wildcardType.getExtendsBound().accept(this, null);
                }
                if (wildcardType.getSuperBound() != null) {
                    wildcardType.getSuperBound().accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType executableType, Void unused) {
                executableType.getReturnType().accept(this, null);
                for (TypeMirror parameterType : executableType.getParameterTypes()) {
                    parameterType.accept(this, null);
                }
                for (TypeMirror thrownType : executableType.getThrownTypes()) {
                    thrownType.accept(this, null);
                }
                for (TypeMirror typeVariable : executableType.getTypeVariables()) {
                    typeVariable.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType intersectionType, Void unused) {
                for (TypeMirror bound : intersectionType.getBounds()) {
                    bound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType unionType, Void unused) {
                for (TypeMirror alternative : unionType.getAlternatives()) {
                    alternative.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitError(ErrorType errorType, Void unused) {
                addLeakIfNeeded(position, errorType.asElement(), violations);
                return null;
            }

            @Override
            public Void visitNoType(NoType noType, Void unused) {
                return null;
            }

            @Override
            public Void visitPrimitive(PrimitiveType primitiveType, Void unused) {
                return null;
            }

            @Override
            public Void visitNull(NullType nullType, Void unused) {
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
                return null;
            }
        }, null);
    }

    private static void addLeakIfNeeded(String position, Element element, List<String> violations) {
        if (element instanceof TypeElement typeElement) {
            String qualifiedName = typeElement.getQualifiedName().toString();
            if (isForbiddenInfrastructureType(qualifiedName)) {
                violations.add("port signature leaks infrastructure type at "
                        + position + " -> " + qualifiedName);
            }
        }
    }

    private static boolean isForbiddenInfrastructureType(String qualifiedName) {
        if (qualifiedName == null || qualifiedName.isBlank()) {
            return false;
        }
        if (FORBIDDEN_INFRASTRUCTURE_TYPES.contains(qualifiedName)) {
            return true;
        }
        for (String prefix : FORBIDDEN_INFRASTRUCTURE_PREFIXES) {
            if (qualifiedName.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
