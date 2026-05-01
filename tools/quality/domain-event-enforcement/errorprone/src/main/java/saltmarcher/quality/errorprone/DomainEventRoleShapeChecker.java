package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.TypeElement;

@BugPattern(
        name = "DomainEventRoleShape",
        summary = "Domain event role packages must use record carriers ending in Event.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainEventRoleShapeChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_EVENT_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.event$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_EVENT_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        if (typeElement.getKind() == ElementKind.RECORD
                && typeElement.getSimpleName().toString().endsWith("Event")) {
            return Description.NO_MATCH;
        }

        return buildDescription(tree)
                .setMessage("Domain event type '" + typeElement.getQualifiedName()
                        + "' violates event/ shape: events must be records ending Event.")
                .build();
    }
}
