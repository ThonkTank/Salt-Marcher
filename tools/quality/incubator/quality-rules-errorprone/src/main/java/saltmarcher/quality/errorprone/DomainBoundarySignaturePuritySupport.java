package saltmarcher.quality.errorprone;

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

final class DomainBoundarySignaturePuritySupport {

    private static final Pattern DOMAIN_ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");
    private static final Pattern DOMAIN_PUBLISHED_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published(\\..*)?$");
    private static final Pattern ROOT_APPLICATION_SERVICE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.[^.]+ApplicationService$");
    private static final Pattern DOMAIN_PUBLISHED_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\..+");
    private static final Pattern DOMAIN_PORT_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.[^.]+\\.port\\.[^.]+(?:Repository|Lookup|Catalog|Search)$");
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
    private static final Set<String> OUTER_LAYER_TYPES = Set.of(
            "java.lang.AutoCloseable",
            "java.io.Closeable");

    private DomainBoundarySignaturePuritySupport() {
    }

    static String boundaryFeature(String packageName) {
        var publishedMatcher = DOMAIN_PUBLISHED_PACKAGE.matcher(packageName);
        if (publishedMatcher.matches()) {
            return publishedMatcher.group(1);
        }
        var rootMatcher = DOMAIN_ROOT_PACKAGE.matcher(packageName);
        if (rootMatcher.matches()) {
            return rootMatcher.group(1);
        }
        return null;
    }

    static boolean isPublishedBoundaryPackage(String packageName) {
        return DOMAIN_PUBLISHED_PACKAGE.matcher(packageName).matches();
    }

    static boolean isRootApplicationService(TypeElement typeElement, String packageName) {
        if (!DOMAIN_ROOT_PACKAGE.matcher(packageName).matches()) {
            return false;
        }
        return topLevelBoundaryType(typeElement).getSimpleName().toString().endsWith("ApplicationService");
    }

    static void collectGeneralBoundaryLeaks(
            TypeElement typeElement,
            String sourceFeature,
            List<String> leaks) {
        collectTypeLeak("extends", typeElement.getSuperclass(), sourceFeature, leaks);
        for (TypeMirror implementedInterface : typeElement.getInterfaces()) {
            collectTypeLeak("implements", implementedInterface, sourceFeature, leaks);
        }
        for (TypeParameterElement typeParameter : typeElement.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName(), bound, sourceFeature, leaks);
            }
        }
        if (typeElement.getKind() == ElementKind.RECORD) {
            for (RecordComponentElement recordComponent : typeElement.getRecordComponents()) {
                collectTypeLeak("record component " + recordComponent.getSimpleName(), recordComponent.asType(), sourceFeature, leaks);
            }
        }

        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(field)) {
                collectTypeLeak("field " + field.getSimpleName(), field.asType(), sourceFeature, leaks);
            }
        }
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(method)) {
                collectExecutableLeaks(String.valueOf(method.getSimpleName()), method, sourceFeature, leaks);
            }
        }
    }

    static void collectPublishedConstructorLeaks(
            TypeElement typeElement,
            String sourceFeature,
            List<String> leaks) {
        for (ExecutableElement constructor : ElementFilter.constructorsIn(typeElement.getEnclosedElements())) {
            if (isPublicOrProtected(constructor)) {
                collectExecutableLeaks("constructor " + typeElement.getSimpleName(), constructor, sourceFeature, leaks);
            }
        }
    }

    static void collectRootConstructorCompositionLeaks(
            TypeElement rootType,
            ExecutableElement constructor,
            List<String> leaks) {
        String rootFeature = domainFeatureName(rootType.getQualifiedName().toString());
        if (rootFeature == null) {
            return;
        }
        for (VariableElement parameter : constructor.getParameters()) {
            collectRootConstructorCompositionLeak(
                    "constructor parameter " + parameter.getSimpleName(),
                    parameter.asType(),
                    rootFeature,
                    leaks);
        }
        for (TypeMirror thrownType : constructor.getThrownTypes()) {
            collectRootConstructorCompositionLeak(
                    "constructor throws clause of " + rootType.getSimpleName(),
                    thrownType,
                    rootFeature,
                    leaks);
        }
        for (TypeParameterElement typeParameter : constructor.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectRootConstructorCompositionLeak(
                        "constructor type bound of " + typeParameter.getSimpleName(),
                        bound,
                        rootFeature,
                        leaks);
            }
        }
    }

    static boolean isPublicOrProtected(Element element) {
        return element.getModifiers().contains(Modifier.PUBLIC)
                || element.getModifiers().contains(Modifier.PROTECTED);
    }

    private static TypeElement topLevelBoundaryType(TypeElement typeElement) {
        TypeElement current = typeElement;
        while (current.getEnclosingElement() instanceof TypeElement enclosingType) {
            current = enclosingType;
        }
        return current;
    }

    private static void collectExecutableLeaks(
            String executableName,
            ExecutableElement executable,
            String sourceFeature,
            List<String> leaks) {
        collectTypeLeak("return type of " + executableName, executable.getReturnType(), sourceFeature, leaks);
        for (VariableElement parameter : executable.getParameters()) {
            collectTypeLeak("parameter " + parameter.getSimpleName() + " of " + executableName, parameter.asType(), sourceFeature, leaks);
        }
        for (TypeMirror thrownType : executable.getThrownTypes()) {
            collectTypeLeak("throws clause of " + executableName, thrownType, sourceFeature, leaks);
        }
        for (TypeParameterElement typeParameter : executable.getTypeParameters()) {
            for (TypeMirror bound : typeParameter.getBounds()) {
                collectTypeLeak("type bound of " + typeParameter.getSimpleName() + " in " + executableName, bound, sourceFeature, leaks);
            }
        }
        TypeMirror executableType = executable.asType();
        if (executableType instanceof ExecutableType) {
            collectTypeLeak("executable signature of " + executableName, executableType, sourceFeature, leaks);
        }
    }

    private static void collectTypeLeak(
            String position,
            TypeMirror typeMirror,
            String sourceFeature,
            List<String> leaks) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                addLeakIfNeeded(position, declaredType.asElement(), sourceFeature, leaks);
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
                addLeakIfNeeded(position, errorType.asElement(), sourceFeature, leaks);
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

    private static void collectRootConstructorCompositionLeak(
            String position,
            TypeMirror typeMirror,
            String rootFeature,
            List<String> leaks) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                addRootConstructorLeakIfNeeded(position, declaredType.asElement(), rootFeature, leaks);
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
                addRootConstructorLeakIfNeeded(position, errorType.asElement(), rootFeature, leaks);
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

    private static void addLeakIfNeeded(
            String position,
            Element element,
            String sourceFeature,
            List<String> leaks) {
        if (element instanceof TypeElement typeElement) {
            String fqn = typeElement.getQualifiedName().toString();
            if (isForbiddenLeak(fqn, sourceFeature)) {
                leaks.add(position + " -> " + fqn);
            }
        }
    }

    private static void addRootConstructorLeakIfNeeded(
            String position,
            Element element,
            String rootFeature,
            List<String> leaks) {
        if (element instanceof TypeElement typeElement) {
            String fqn = typeElement.getQualifiedName().toString();
            if (isForbiddenRootConstructorCompositionType(typeElement, fqn, rootFeature)) {
                leaks.add(position + " -> " + fqn);
            }
        }
    }

    private static boolean isForbiddenLeak(String fqn, String sourceFeature) {
        if (fqn == null || fqn.isBlank()) {
            return false;
        }
        if (OUTER_LAYER_TYPES.contains(fqn)) {
            return true;
        }
        for (String outerPrefix : OUTER_LAYER_PREFIXES) {
            if (fqn.startsWith(outerPrefix)) {
                return true;
            }
        }
        if (!fqn.startsWith("src.domain.")) {
            return false;
        }

        if (domainFeatureName(fqn) == null) {
            return false;
        }
        var publishedMatcher = DOMAIN_PUBLISHED_TYPE.matcher(fqn);
        return !publishedMatcher.matches() || !publishedMatcher.group(1).equals(sourceFeature);
    }

    private static boolean isForbiddenRootConstructorCompositionType(
            TypeElement typeElement,
            String fqn,
            String rootFeature) {
        if (fqn == null || fqn.isBlank()) {
            return false;
        }
        if (OUTER_LAYER_TYPES.contains(fqn)) {
            return true;
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
        if (targetFeature == null) {
            return false;
        }
        if (isForeignRootApplicationService(fqn, rootFeature)) {
            return false;
        }
        return !targetFeature.equals(rootFeature) || !isSameFeatureDomainPort(typeElement, rootFeature);
    }

    private static boolean isForeignRootApplicationService(String fqn, String rootFeature) {
        var matcher = ROOT_APPLICATION_SERVICE_TYPE.matcher(fqn);
        return matcher.matches() && !matcher.group(1).equals(rootFeature);
    }

    private static boolean isSameFeatureDomainPort(TypeElement typeElement, String rootFeature) {
        if (typeElement.getKind() != ElementKind.INTERFACE) {
            return false;
        }
        var matcher = DOMAIN_PORT_TYPE.matcher(typeElement.getQualifiedName().toString());
        return matcher.matches() && matcher.group(1).equals(rootFeature);
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
