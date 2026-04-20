package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.MethodTree;
import com.sun.tools.javac.code.Symbol;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.element.Element;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeKind;

@BugPattern(
        name = "DomainApplicationServiceApiShape",
        summary = "Root domain ApplicationService APIs must use same-context published command/query/result carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainApplicationServiceApiShapeChecker extends BugChecker
        implements BugChecker.MethodTreeMatcher, BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_ROOT_PACKAGE = Pattern.compile("^src\\.domain\\.([^.]+)$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }
        if (!typeElement.getModifiers().contains(Modifier.PUBLIC)
                && !typeElement.getModifiers().contains(Modifier.PROTECTED)) {
            return Description.NO_MATCH;
        }

        Element enclosingElement = typeElement.getEnclosingElement();
        if (!(enclosingElement instanceof TypeElement enclosingType)
                || enclosingType.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        Matcher matcher = DOMAIN_ROOT_PACKAGE.matcher(
                DataArchitectureSupport.packageName(state.getPath().getCompilationUnit()));
        if (!matcher.matches()
                || !enclosingType.getSimpleName().toString().endsWith("ApplicationService")) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Root domain ApplicationService '"
                        + enclosingType.getQualifiedName()
                        + "' must not declare public or protected nested contract type '"
                        + typeElement.getSimpleName()
                        + "'. Export the root service directly through ServiceRegistry instead of legacy nested factories.")
                .build();
    }

    @Override
    public Description matchMethod(MethodTree tree, VisitorState state) {
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(tree);
        if (methodSymbol == null || methodSymbol.isConstructor()) {
            return Description.NO_MATCH;
        }
        if (!methodSymbol.getModifiers().contains(Modifier.PUBLIC)
                && !methodSymbol.getModifiers().contains(Modifier.PROTECTED)) {
            return Description.NO_MATCH;
        }
        if (!(methodSymbol.getEnclosingElement() instanceof TypeElement enclosingType)
                || enclosingType.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        Matcher matcher = DOMAIN_ROOT_PACKAGE.matcher(
                DataArchitectureSupport.packageName(state.getPath().getCompilationUnit()));
        if (!matcher.matches()
                || !enclosingType.getSimpleName().toString().endsWith("ApplicationService")) {
            return Description.NO_MATCH;
        }

        String feature = matcher.group(1);
        if (methodSymbol.getParameters().size() != 1) {
            return violation(tree, methodSymbol, feature,
                    "declare exactly one published command/query parameter");
        }
        VariableElement parameter = methodSymbol.getParameters().get(0);
        if (!isSameFeaturePublishedType(parameter.asType(), feature)) {
            return violation(tree, methodSymbol, feature,
                    "accept one same-feature published command/query parameter");
        }
        if (methodSymbol.getReturnType().getKind() == TypeKind.VOID) {
            return violation(tree, methodSymbol, feature,
                    "return a same-feature published result/value carrier instead of void");
        }
        if (!isSameFeaturePublishedType(methodSymbol.getReturnType(), feature)) {
            return violation(tree, methodSymbol, feature,
                    "return a same-feature published result/value carrier directly");
        }
        return Description.NO_MATCH;
    }

    private Description violation(MethodTree tree, Symbol.MethodSymbol methodSymbol, String feature, String requirement) {
        return buildDescription(tree)
                .setMessage("Root domain ApplicationService method '"
                        + methodSymbol.getEnclosingElement().getSimpleName()
                        + "."
                        + methodSymbol.getSimpleName()
                        + "' must "
                        + requirement
                        + "; expected src.domain."
                        + feature
                        + ".published.* carriers on both sides of the public boundary.")
                .build();
    }

    private static boolean isSameFeaturePublishedType(TypeMirror typeMirror, String feature) {
        if (!(typeMirror instanceof DeclaredType declaredType)
                || !(declaredType.asElement() instanceof TypeElement typeElement)) {
            return false;
        }
        String qualifiedName = typeElement.getQualifiedName().toString();
        return qualifiedName.startsWith("src.domain." + feature + ".published.");
    }
}
