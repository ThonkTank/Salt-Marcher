package saltmarcher.quality.errorprone.data.servicecontribution;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.lang.model.type.TypeMirror;

@BugPattern(
        name = "DataServiceContributionRegisterExportShape",
        summary = "Data ServiceContribution roots may export only same-feature root domain ApplicationServices through ServiceRegistry.register(...).",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataServiceContributionRegisterExportShapeChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final String SERVICE_REGISTRY_BUILDER = "shell.api.ServiceRegistry.Builder";
    private static final Pattern CLASS_LITERAL_TYPE =
            Pattern.compile("^java\\.lang\\.Class<\\??\\s*(?:extends\\s+)?([^>]+)>$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        Matcher packageMatcher = DataServiceContributionArchitectureSupport.DATA_ROOT_PACKAGE.matcher(
                DataServiceContributionArchitectureSupport.packageName(tree));
        if (!packageMatcher.matches()) {
            return Description.NO_MATCH;
        }

        String feature = packageMatcher.group(1);
        String expectedService = "src.domain." + feature + ".*ApplicationService";
        List<String> violations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(methodInvocation);
                if (symbol == null
                        || !"register".contentEquals(symbol.getSimpleName())
                        || !SERVICE_REGISTRY_BUILDER.equals(ownerTypeName(symbol))
                        || methodInvocation.getArguments().isEmpty()) {
                    return super.visitMethodInvocation(methodInvocation, null);
                }

                Tree serviceKeyArgument = methodInvocation.getArguments().getFirst();
                String serviceKey = classLiteralTypeName(serviceKeyArgument);
                if (!isSameFeatureRootApplicationService(serviceKey, feature)) {
                    violations.add(serviceKey.isBlank()
                            ? "<unresolved service key: " + serviceKeyArgument + ">"
                            : serviceKey);
                }
                return super.visitMethodInvocation(methodInvocation, null);
            }
        }.scan(tree, null);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Data ServiceContribution root for feature '" + feature
                        + "' may export only " + expectedService
                        + " through shell.api.ServiceRegistry.register(...). Forbidden service keys: "
                        + String.join(", ", violations))
                .build();
    }

    private static String classLiteralTypeName(Tree argument) {
        if (argument instanceof MemberSelectTree memberSelect
                && "class".contentEquals(memberSelect.getIdentifier())) {
            TypeMirror selectedType = ASTHelpers.getType(memberSelect.getExpression());
            if (selectedType != null) {
                return selectedType.toString();
            }
        }

        TypeMirror argumentType = ASTHelpers.getType(argument);
        if (argumentType != null) {
            Matcher matcher = CLASS_LITERAL_TYPE.matcher(argumentType.toString());
            if (matcher.matches()) {
                return matcher.group(1).trim();
            }
        }

        String source = argument.toString();
        if (source.endsWith(".class")) {
            return source.substring(0, source.length() - ".class".length());
        }
        return "";
    }

    private static boolean isSameFeatureRootApplicationService(String serviceKey, String feature) {
        String expectedPrefix = "src.domain." + feature + ".";
        if (!serviceKey.startsWith(expectedPrefix)) {
            return false;
        }
        String simpleName = serviceKey.substring(expectedPrefix.length());
        return !simpleName.contains(".") && simpleName.endsWith("ApplicationService");
    }

    private static String ownerTypeName(Symbol symbol) {
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }
}
