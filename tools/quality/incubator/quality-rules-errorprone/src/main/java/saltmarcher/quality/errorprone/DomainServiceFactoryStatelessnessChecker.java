package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DomainServiceFactoryStatelessness",
        summary = "Named-module domain services, factories, and policies must be stateless.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainServiceFactoryStatelessnessChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern DOMAIN_STATELESS_ROLE_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.[^.]+\\.(policy|factory|service)$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!DOMAIN_STATELESS_ROLE_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        List<String> instanceFields = new ArrayList<>();
        for (VariableElement field : ElementFilter.fieldsIn(typeElement.getEnclosedElements())) {
            if (!field.getModifiers().contains(Modifier.STATIC)) {
                instanceFields.add(field.getSimpleName().toString());
            }
        }

        if (instanceFields.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Named-module domain policy/factory/service role '" + typeElement.getQualifiedName()
                        + "' declares instance field(s): " + String.join(", ", instanceFields)
                        + ". Domain services, factories, and policies must be stateless.")
                .build();
    }
}
