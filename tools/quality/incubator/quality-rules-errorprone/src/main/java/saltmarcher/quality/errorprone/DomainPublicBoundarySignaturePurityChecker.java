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
        name = "DomainPublicBoundarySignaturePurity",
        summary = "Public domain boundary signatures must stay free of outer-layer and foreign private domain types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublicBoundarySignaturePurityChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");
    private static final Pattern DOMAIN_API_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)\\.api(\\..*)?$");
    private static final Pattern APPLICATION_SERVICE_TYPE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+ApplicationService(?:[.$].+)?$");
    private static final Pattern DOMAIN_API_TYPE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.api\\..+");
    private static final Set<String> OUTER_LAYER_PREFIXES = Set.of(
            "bootstrap.",
            "shell.",
            "src.view.",
            "src.data.",
            "javafx.",
            "java.sql.",
            "javax.sql.",
            "javax.json.",
            "jakarta.json.",
            "com.fasterxml.jackson.",
            "org.json.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.io.",
            "java.nio.file."
    );

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = state.getPath().getCompilationUnit().getPackageName() == null
                ? ""
                : state.getPath().getCompilationUnit().getPackageName().toString();
        String ownFeature = boundaryFeature(packageName);
        if (ownFeature == null) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }
        if (!isBoundaryType(typeElement, packageName)) {
            return Description.NO_MATCH;
        }

        List<String> leaks = new ArrayList<>();

        collectTypeLeak("extends", typeElement.getSuperclass(), ownFeature, leaks);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectTypeLeak("implements", implementedInterface, ownFeature, leaks);
        }
        for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName(), bound, ownFeature, leaks);
            }
        }
        if (typeElement.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                collectTypeLeak("record component " + recordComponent.getSimpleName(), recordComponent.asType(), ownFeature, leaks);
            }
        }

        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(field)) {
                collectTypeLeak("field " + field.getSimpleName(), field.asType(), ownFeature, leaks);
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(method)) {
                collectExecutableLeaks(String.valueOf(method.getSimpleName()), method, ownFeature, leaks);
            }
        }

        if (DOMAIN_API_PACKAGE.matcher(packageName).matches()) {
            for (ExecutableElement constructor : ElementFilter.constructorsIn(typeElement.getEnclosedElements())) {
                if (isPublicOrProtected(constructor)) {
                    collectExecutableLeaks("constructor " + typeElement.getSimpleName(), constructor, ownFeature, leaks);
                }
            }
        }

        if (leaks.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Public domain boundary type '" + typeElement.getQualifiedName()
                        + "' leaks outer-layer or foreign private domain types in its signature: "
                        + String.join("; ", leaks))
                .build();
    }

    private static String boundaryFeature(String packageName) {
        var apiMatcher = DOMAIN_API_PACKAGE.matcher(packageName);
        if (apiMatcher.matches()) {
            return apiMatcher.group(1);
        }
        var rootMatcher = DOMAIN_ROOT_PACKAGE.matcher(packageName);
        if (rootMatcher.matches()) {
            return rootMatcher.group(1);
        }
        return null;
    }

    private static boolean isBoundaryType(TypeElement typeElement, String packageName) {
        if (DOMAIN_API_PACKAGE.matcher(packageName).matches()) {
            return true;
        }
        if (!DOMAIN_ROOT_PACKAGE.matcher(packageName).matches()) {
            return false;
        }
        return topLevelBoundaryType(typeElement).getSimpleName().toString().endsWith("ApplicationService");
    }

    private static TypeElement topLevelBoundaryType(TypeElement typeElement) {
        TypeElement current = typeElement;
        while (current.getEnclosingElement() instanceof TypeElement enclosingType) {
            current = enclosingType;
        }
        return current;
    }

    private static boolean isPublicOrProtected(Element element) {
        return element.getModifiers().contains(Modifier.PUBLIC)
                || element.getModifiers().contains(Modifier.PROTECTED);
    }

    private static void collectExecutableLeaks(
            String executableName,
            ExecutableElement executable,
            String ownFeature,
            List<String> leaks) {
        collectTypeLeak("return type of " + executableName, executable.getReturnType(), ownFeature, leaks);
        for (VariableElement parameter : executable.getParameters()) {
            collectTypeLeak("parameter " + parameter.getSimpleName() + " of " + executableName, parameter.asType(), ownFeature, leaks);
        }
        for (TypeMirror thrownType : executable.getThrownTypes()) {
            collectTypeLeak("throws clause of " + executableName, thrownType, ownFeature, leaks);
        }
        for (TypeParameterElement typeParameter : executable.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName() + " in " + executableName, bound, ownFeature, leaks);
            }
        }
        TypeMirror executableType = executable.asType();
        if (executableType instanceof ExecutableType) {
            collectTypeLeak("executable signature of " + executableName, executableType, ownFeature, leaks);
        }
    }

    private static void collectTypeLeak(String position, TypeMirror typeMirror, String ownFeature, List<String> leaks) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                addLeakIfNeeded(position, declaredType.asElement(), ownFeature, leaks);
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
                addLeakIfNeeded(position, errorType.asElement(), ownFeature, leaks);
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
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
        }, null);
    }

    private static void addLeakIfNeeded(String position, Element element, String ownFeature, List<String> leaks) {
        if (element instanceof TypeElement typeElement) {
            String fqn = typeElement.getQualifiedName().toString();
            if (isForbiddenLeak(fqn, ownFeature)) {
                leaks.add(position + " -> " + fqn);
            }
        }
    }

    private static boolean isForbiddenLeak(String fqn, String ownFeature) {
        if (fqn == null || fqn.isBlank()) {
            return false;
        }
        for (String outerPrefix : OUTER_LAYER_PREFIXES) {
            if (fqn.startsWith(outerPrefix)) {
                return true;
            }
        }
        if (!fqn.startsWith("src.domain.")) {
            return false;
        }

        String targetFeature = domainFeatureName(fqn);
        if (targetFeature == null || ownFeature.equals(targetFeature)) {
            return false;
        }
        return !APPLICATION_SERVICE_TYPE.matcher(fqn).matches()
                && !DOMAIN_API_TYPE.matcher(fqn).matches();
    }

    private static String domainFeatureName(String fqn) {
        String prefix = "src.domain.";
        if (!fqn.startsWith(prefix)) {
            return null;
        }
        String remainder = fqn.substring(prefix.length());
        int separator = remainder.indexOf('.');
        return separator >= 0 ? remainder.substring(0, separator) : remainder;
    }
}
