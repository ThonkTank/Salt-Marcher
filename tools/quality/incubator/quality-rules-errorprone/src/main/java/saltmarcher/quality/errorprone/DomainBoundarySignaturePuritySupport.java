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
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.ElementFilter;

final class DomainBoundarySignaturePuritySupport {

    private static final Pattern DOMAIN_ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");
    private static final Pattern DOMAIN_PUBLISHED_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published(\\..*)?$");
    private static final Pattern DOMAIN_PUBLISHED_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\..+");
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
        for (String referencedType : TypeMirrorReferenceScanner.collectTypeReferences(typeMirror)) {
            if (isForbiddenLeak(referencedType, sourceFeature)) {
                leaks.add(position + " -> " + referencedType);
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
