package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.tools.javac.code.Symbol;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;

@BugPattern(
        name = "DomainPublishedReadModelShape",
        summary = "Only published/*Model handles may own current()/subscribe() read-side publication.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublishedReadModelShapeChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_PUBLISHED_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published(\\..*)?$");
    private static final String CONSUMER_PREFIX = "java.util.function.Consumer<";
    private static final String RUNNABLE_TYPE = "java.lang.Runnable";

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        Matcher matcher = DOMAIN_PUBLISHED_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }
        if (!typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }

        String feature = matcher.group(1);
        String simpleName = typeElement.getSimpleName().toString();
        if (simpleName.endsWith("Model")) {
            return validateModelHandle(tree, typeElement, feature);
        }
        return validatePassiveCarrier(tree, typeElement);
    }

    private Description validateModelHandle(ClassTree tree, TypeElement typeElement, String feature) {
        if (typeElement.getKind() != ElementKind.RECORD) {
            return buildDescription(tree)
                    .setMessage("Published read-model handle '" + typeElement.getQualifiedName()
                            + "' must be a public record so same-context readback stays a passive handle surface.")
                    .build();
        }

        Symbol.MethodSymbol currentMethod = null;
        for (var enclosedElement : typeElement.getEnclosedElements()) {
            if (!(enclosedElement instanceof Symbol.MethodSymbol methodSymbol)
                    || !methodSymbol.getModifiers().contains(Modifier.PUBLIC)) {
                continue;
            }
            if (methodSymbol.getSimpleName().contentEquals("current")
                    && methodSymbol.getParameters().isEmpty()) {
                currentMethod = methodSymbol;
                break;
            }
        }
        if (currentMethod == null) {
            return buildDescription(tree)
                    .setMessage("Published read-model handle '" + typeElement.getQualifiedName()
                            + "' must expose public current() for read-side state access.")
                    .build();
        }
        if (!isSameFeaturePublishedNonModelType(currentMethod.getReturnType(), feature)) {
            return buildDescription(tree)
                    .setMessage("Published read-model handle '" + typeElement.getQualifiedName()
                            + "' must return one same-context non-model published carrier from current().")
                    .build();
        }

        String currentReturnType = currentMethod.getReturnType().toString();
        for (var enclosedElement : typeElement.getEnclosedElements()) {
            if (!(enclosedElement instanceof Symbol.MethodSymbol methodSymbol)
                    || !methodSymbol.getModifiers().contains(Modifier.PUBLIC)
                    || !methodSymbol.getSimpleName().contentEquals("subscribe")) {
                continue;
            }
            if (methodSymbol.getParameters().size() == 1
                    && RUNNABLE_TYPE.equals(methodSymbol.getReturnType().toString())
                    && isMatchingConsumerParameter(methodSymbol.getParameters().get(0).asType(), currentReturnType)) {
                return Description.NO_MATCH;
            }
        }

        return buildDescription(tree)
                .setMessage("Published read-model handle '" + typeElement.getQualifiedName()
                        + "' must expose public subscribe(Consumer<" + currentReturnType
                        + ">) returning Runnable.")
                .build();
    }

    private Description validatePassiveCarrier(ClassTree tree, TypeElement typeElement) {
        for (var enclosedElement : typeElement.getEnclosedElements()) {
            if (!(enclosedElement instanceof Symbol.MethodSymbol methodSymbol)
                    || !methodSymbol.getModifiers().contains(Modifier.PUBLIC)) {
                continue;
            }
            if (methodSymbol.getSimpleName().contentEquals("current")
                    || methodSymbol.getSimpleName().contentEquals("subscribe")) {
                return buildDescription(tree)
                        .setMessage("Published non-model carrier '" + typeElement.getQualifiedName()
                                + "' must stay passive; only same-context published/*Model handles may expose current()/subscribe().")
                        .build();
            }
        }
        return Description.NO_MATCH;
    }

    private static boolean isSameFeaturePublishedNonModelType(TypeMirror typeMirror, String feature) {
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof TypeElement typeElement)) {
            return false;
        }
        String qualifiedName = typeElement.getQualifiedName().toString();
        return qualifiedName.startsWith("src.domain." + feature + ".published.")
                && !typeElement.getSimpleName().toString().endsWith("Model");
    }

    private static boolean isMatchingConsumerParameter(TypeMirror parameterType, String currentReturnType) {
        return (CONSUMER_PREFIX + currentReturnType + ">").equals(parameterType.toString());
    }
}
