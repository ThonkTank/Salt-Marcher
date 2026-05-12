package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.ArrayList;
import java.util.List;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;

@BugPattern(
        name = "DomainPublicBoundarySignaturePurity",
        summary = "Public domain boundary signatures must stay free of outer-layer, private domain, and foreign published types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublicBoundarySignaturePurityChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }
        if (!DomainBoundarySignaturePuritySupport.isRootApplicationService(typeElement, packageName)) {
            return Description.NO_MATCH;
        }

        String sourceFeature = DomainBoundarySignaturePuritySupport.boundaryFeature(packageName);
        if (sourceFeature == null) {
            return Description.NO_MATCH;
        }
        List<String> leaks = new ArrayList<>();
        DomainBoundarySignaturePuritySupport.collectGeneralBoundaryLeaks(typeElement, sourceFeature, leaks);

        if (leaks.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Public domain boundary type '" + typeElement.getQualifiedName()
                        + "' leaks outer-layer, private domain, or foreign published types in its signature: "
                        + String.join("; ", leaks))
                .build();
    }
}
