package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.util.ElementFilter;

@BugPattern(
        name = "DomainPublishedOwnershipBoundary",
        summary = "Only published/** may own outward published return surfaces and publisher-shaped top-level roles.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublishedOwnershipBoundaryChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!packageName.startsWith("src.domain.") || packageName.contains(".published")) {
            return Description.NO_MATCH;
        }

        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null || typeElement.getNestingKind().isNested()) {
            return Description.NO_MATCH;
        }

        String rawFeature = packageName.substring("src.domain.".length());
        int separator = rawFeature.indexOf('.');
        final String feature = separator >= 0 ? rawFeature.substring(0, separator) : rawFeature;

        Set<String> violations = new LinkedHashSet<>();
        String simpleName = typeElement.getSimpleName().toString();
        if (simpleName.endsWith("Publisher")) {
            violations.add("top-level publisher role " + simpleName);
        }
        ElementFilter.fieldsIn(typeElement.getEnclosedElements()).stream()
                .filter(DomainBoundarySignaturePuritySupport::isPublicOrProtected)
                .forEach(field -> {
                    for (String referencedType : DomainRoleConcernSupport.collectTypeReferences(field.asType())) {
                        if (DomainRoleConcernSupport.isSameFeaturePublishedType(referencedType, feature)) {
                            violations.add("public/protected field " + field.getSimpleName()
                                    + " exposes same-context published type " + referencedType);
                        }
                    }
                });
        ElementFilter.methodsIn(typeElement.getEnclosedElements()).stream()
                .filter(DomainBoundarySignaturePuritySupport::isPublicOrProtected)
                .forEach(method -> {
                    if (method.getSimpleName().toString().startsWith("publish")) {
                        method.getParameters().forEach(parameter -> {
                            for (String referencedType : DomainRoleConcernSupport.collectTypeReferences(parameter.asType())) {
                                if (DomainRoleConcernSupport.isSameFeaturePublishedType(referencedType, feature)) {
                                    violations.add("publish* method " + method.getSimpleName()
                                            + " accepts same-context published type " + referencedType);
                                }
                            }
                        });
                    }
                    for (String referencedType : DomainRoleConcernSupport.collectTypeReferences(method.getReturnType())) {
                        if (DomainRoleConcernSupport.isSameFeaturePublishedType(referencedType, feature)) {
                            violations.add("public/protected method " + method.getSimpleName()
                                    + " returns same-context published type " + referencedType);
                        }
                    }
                });

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain type '" + typeElement.getQualifiedName()
                        + "' violates the closed published-ownership boundary: "
                        + String.join("; ", violations)
                        + ". Outside published/**, domain code must not own publisher-shaped top-level roles or outward same-context published return surfaces.")
                .build();
    }
}
