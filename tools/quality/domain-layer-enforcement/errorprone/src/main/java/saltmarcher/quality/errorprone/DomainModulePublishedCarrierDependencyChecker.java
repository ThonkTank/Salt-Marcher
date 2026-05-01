package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.TreeSet;
import java.util.regex.Pattern;

@BugPattern(
        name = "DomainModuleNoPublishedCarrierDependency",
        summary = "Named domain modules must not depend on public published command/query/result carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainModulePublishedCarrierDependencyChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern NAMED_DOMAIN_MODULE_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.((?!published$|application$)[^.]+)(\\..*)?$");
    private static final Pattern DOMAIN_PUBLISHED_TYPE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.published\\..+");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        var matcher = NAMED_DOMAIN_MODULE_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }

        TreeSet<String> forbiddenReferences = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenPublishedCarrier(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Named domain module '" + packageName
                        + "' depends on published carrier type(s): "
                        + String.join(", ", forbiddenReferences)
                        + ". Translate published carriers at the root/application boundary before entering the model.")
                .build();
    }

    private static boolean isForbiddenPublishedCarrier(String referencedType) {
        return DOMAIN_PUBLISHED_TYPE.matcher(referencedType).matches();
    }
}
