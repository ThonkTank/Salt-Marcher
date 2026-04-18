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
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DataGatewayReturnTypeBoundary",
        summary = "Gateway packages must not expose domain or exported backend types as method return values.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataGatewayReturnTypeBoundaryChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DataArchitectureSupport.GATEWAY_PACKAGE.matcher(packageName).matches()) {
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
                if (DataArchitectureSupport.isDomainType(referencedType)) {
                    violations.add("return type of " + method.getSimpleName() + " -> " + referencedType);
                }
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Gateway package '" + packageName
                        + "' exposes domain-facing return types: " + String.join("; ", violations))
                .build();
    }
}
