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
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DataGatewayReturnTypeBoundary",
        summary = "Source-adapter packages must not expose domain or exported backend types as method return values.",
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

        List<String> violations = new ArrayList<>();
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            if (!method.getModifiers().contains(Modifier.PUBLIC)
                    && !method.getModifiers().contains(Modifier.PROTECTED)) {
                continue;
            }
            Set<String> referencedTypes = new LinkedHashSet<>();
            DataArchitectureSupport.collectTypeReferences(method.getReturnType(), referencedTypes);
            for (String referencedType : referencedTypes) {
                if (!isAllowedGatewayReturnType(referencedType, featureName)) {
                    violations.add("return type of " + method.getSimpleName() + " -> " + referencedType);
                }
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Source-adapter package '" + packageName
                        + "' exposes return types outside source-local data records or JDK value/container types: "
                        + String.join("; ", violations))
                .build();
    }

    private static String featureName(String packageName) {
        Matcher matcher = DataArchitectureSupport.GATEWAY_PACKAGE.matcher(packageName);
        return matcher.matches() ? matcher.group(1) : null;
    }

    private static boolean isAllowedGatewayReturnType(String referencedType, String featureName) {
        if (referencedType.startsWith("src.data." + featureName + ".model.")) {
            return true;
        }
        if (referencedType.startsWith("java.lang.")) {
            return true;
        }
        return referencedType.startsWith("java.util.");
    }
}
