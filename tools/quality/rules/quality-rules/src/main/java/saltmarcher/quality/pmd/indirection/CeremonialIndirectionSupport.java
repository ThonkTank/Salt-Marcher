package saltmarcher.quality.pmd.indirection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.ast.Node;
import net.sourceforge.pmd.lang.document.TextRegion;
import net.sourceforge.pmd.lang.java.ast.ASTBlock;
import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTMethodDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTStatement;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class CeremonialIndirectionSupport {

    private static final Pattern REQUIRE_NON_NULL_STATEMENT = Pattern.compile(
            "^(?:[A-Za-z_][A-Za-z0-9_$.<>\\[\\]\\s]*\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*)?"
                    + "(?:(?:java\\.util\\.)?Objects\\.)?requireNonNull\\s*\\(.*\\)\\s*;?$",
            Pattern.DOTALL);
    private static final Pattern IF_NULL_GUARD_STATEMENT = Pattern.compile(
            "^if\\s*\\(\\s*[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*\\s*==\\s*null\\s*\\)\\s*"
                    + "(?:\\{\\s*)?throw\\s+new\\s+[A-Za-z_][A-Za-z0-9_$.]*\\s*\\(.*\\)\\s*;?\\s*(?:\\}\\s*)?$",
            Pattern.DOTALL);
    private static final Pattern TRIVIAL_ALIAS_STATEMENT = Pattern.compile(
            "^(?:final\\s+)?(?:var|[A-Za-z_][A-Za-z0-9_$.<>\\[\\]\\s]*)\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*"
                    + "(?:this\\.)?[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*\\s*;?$",
            Pattern.DOTALL);
    private static final Pattern TRIVIAL_NEW_STATEMENT = Pattern.compile(
            "^return\\s+new\\s+([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\([^()]*\\)\\s*;?$",
            Pattern.DOTALL);
    private static final Pattern TRIVIAL_CALL_STATEMENT = Pattern.compile(
            "^(?:return\\s+)?([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\([^()]*\\)\\s*;?$",
            Pattern.DOTALL);

    private CeremonialIndirectionSupport() {
    }

    public static Optional<Role> substantiveRole(SaltMarcherSourceFacts sourceFacts) {
        return Role.SUBSTANTIVE_ROLES.stream()
                .filter(role -> role.matches(sourceFacts))
                .findFirst();
    }

    public static Optional<Role> candidateRole(SaltMarcherSourceFacts sourceFacts) {
        return Role.CANDIDATE_ROLES.stream()
                .filter(role -> role.matches(sourceFacts))
                .findFirst();
    }

    public static Analysis analyze(ASTCompilationUnit node, SaltMarcherSourceFacts sourceFacts) {
        ASTClassDeclaration topLevelClass = topLevelClass(node, sourceFacts.simpleName());
        if (topLevelClass == null) {
            return Analysis.notCeremonial();
        }

        List<ASTMethodDeclaration> nonConstructorMethods = topLevelClass.descendants(ASTMethodDeclaration.class)
                .filter(method -> enclosingTopLevelClass(method) == topLevelClass)
                .toList();
        if (nonConstructorMethods.isEmpty()) {
            return Analysis.notCeremonial();
        }

        Set<String> localMethodNames = new LinkedHashSet<>();
        for (ASTMethodDeclaration method : nonConstructorMethods) {
            localMethodNames.add(method.getName());
        }

        Set<String> collaboratorTargets = new LinkedHashSet<>();
        List<String> trivialDescriptions = new ArrayList<>();
        for (ASTMethodDeclaration method : nonConstructorMethods) {
            MethodShape shape = classifyMethod(method, sourceFacts, localMethodNames);
            if (shape == null) {
                return Analysis.notCeremonial();
            }
            if (shape.externalTarget() != null) {
                collaboratorTargets.add(shape.externalTarget());
            }
            trivialDescriptions.add(method.getName() + " -> " + shape.description());
        }

        if (collaboratorTargets.isEmpty() || collaboratorTargets.size() > 1) {
            return Analysis.notCeremonial();
        }
        return new Analysis(true, collaboratorTargets.iterator().next(), List.copyOf(trivialDescriptions));
    }

    private static ASTClassDeclaration topLevelClass(ASTCompilationUnit node, String simpleName) {
        ASTClassDeclaration matchingTopLevel = node.children(ASTClassDeclaration.class)
                .filter(ASTClassDeclaration::isRegularClass)
                .filter(type -> simpleName.equals(type.getSimpleName()))
                .first();
        if (matchingTopLevel != null) {
            return matchingTopLevel;
        }
        return node.descendants(ASTClassDeclaration.class)
                .filter(ASTClassDeclaration::isRegularClass)
                .filter(type -> simpleName.equals(type.getSimpleName()))
                .first();
    }

    private static ASTClassDeclaration enclosingTopLevelClass(Node node) {
        return node.ancestors(ASTClassDeclaration.class).last();
    }

    private static MethodShape classifyMethod(
            ASTMethodDeclaration method,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames
    ) {
        ASTBlock body = method.firstChild(ASTBlock.class);
        if (body == null) {
            return null;
        }
        List<ASTStatement> effectiveStatements = new ArrayList<>();
        for (ASTStatement statement : body.children(ASTStatement.class).toList()) {
            if (isSkippableGuard(statement, sourceFacts) || isTrivialAlias(statement, sourceFacts)) {
                continue;
            }
            effectiveStatements.add(statement);
        }
        if (effectiveStatements.size() != 1) {
            return null;
        }
        return classifyEffectiveStatement(effectiveStatements.getFirst(), sourceFacts, localMethodNames);
    }

    private static boolean isSkippableGuard(ASTStatement statement, SaltMarcherSourceFacts sourceFacts) {
        String statementText = normalizedStatementText(statement, sourceFacts);
        return REQUIRE_NON_NULL_STATEMENT.matcher(statementText).matches()
                || IF_NULL_GUARD_STATEMENT.matcher(statementText).matches();
    }

    private static boolean isTrivialAlias(ASTStatement statement, SaltMarcherSourceFacts sourceFacts) {
        return TRIVIAL_ALIAS_STATEMENT.matcher(normalizedStatementText(statement, sourceFacts)).matches();
    }

    private static MethodShape classifyEffectiveStatement(
            ASTStatement statement,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames
    ) {
        String statementText = normalizedStatementText(statement, sourceFacts);

        Matcher newMatcher = TRIVIAL_NEW_STATEMENT.matcher(statementText);
        if (newMatcher.matches()) {
            String constructedType = newMatcher.group(1);
            return new MethodShape("wraps constructor " + constructedType, "new:" + constructedType);
        }

        Matcher callMatcher = TRIVIAL_CALL_STATEMENT.matcher(statementText);
        if (!callMatcher.matches()) {
            return null;
        }
        String callee = callMatcher.group(1);
        if (callee.contains(").") || callee.startsWith("new ")) {
            return null;
        }
        String externalTarget = externalTarget(callee, localMethodNames);
        String description = statementText.startsWith("return ")
                ? "returns delegated call " + callee + "(...)"
                : "forwards delegated call " + callee + "(...)";
        return new MethodShape(description, externalTarget);
    }

    private static String externalTarget(String callee, Set<String> localMethodNames) {
        String methodName = callee.contains(".")
                ? callee.substring(callee.lastIndexOf('.') + 1)
                : callee;
        if (!callee.contains(".") && localMethodNames.contains(methodName)) {
            return null;
        }
        int lastDot = callee.lastIndexOf('.');
        if (lastDot > 0) {
            return callee.substring(0, lastDot);
        }
        return callee;
    }

    private static String normalizedStatementText(ASTStatement statement, SaltMarcherSourceFacts sourceFacts) {
        TextRegion region = statement.getTextRegion();
        String rawText = sourceFacts.text().substring(region.getStartOffset(), region.getEndOffset());
        return stripCommentsAndStrings(rawText).replaceAll("\\s+", " ").trim();
    }

    private static String stripCommentsAndStrings(String text) {
        StringBuilder result = new StringBuilder(text.length());
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                    result.append(current);
                } else {
                    result.append(' ');
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    result.append("  ");
                    index++;
                } else {
                    result.append(current == '\n' || current == '\r' ? current : ' ');
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                result.append(' ');
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                result.append(' ');
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                result.append(' ');
                continue;
            }
            if (current == '\'') {
                inChar = true;
                result.append(' ');
                continue;
            }
            result.append(current);
        }
        return result.toString();
    }

    public enum Role {
        DOMAIN_SERVICE(
                "Service",
                "service roles must contribute domain behavior instead of only relaying to ",
                "^src/domain/[^/]+/[^/]+/service/[^/]+\\.java$",
                null),
        DOMAIN_POLICY(
                "Policy",
                "policy roles must contribute reusable policy instead of only relaying to ",
                "^src/domain/[^/]+/[^/]+/policy/[^/]+\\.java$",
                null),
        DOMAIN_FACTORY(
                "Factory",
                "factory roles must own meaningful construction logic instead of only relaying to ",
                "^src/domain/[^/]+/[^/]+/factory/[^/]+\\.java$",
                null),
        DOMAIN_APPLICATION_SERVICE(
                "ApplicationService",
                null,
                "^src/domain/[^/]+/[^/]+ApplicationService\\.java$",
                "this role is allowed to stay thin at the root boundary"),
        DOMAIN_USE_CASE(
                "UseCase",
                null,
                "^src/domain/[^/]+/application/[^/]+UseCase\\.java$",
                "application orchestration may be intentionally thin"),
        VIEW_BINDER(
                "Binder",
                null,
                "^src/view/.+Binder\\.java$",
                "runtime composition adapters may legitimately wire and relay"),
        VIEW_INTENT_HANDLER(
                "IntentHandler",
                null,
                "^src/view/.+IntentHandler\\.java$",
                "local input interpretation may stay thin"),
        DATA_SERVICE_CONTRIBUTION(
                "ServiceContribution",
                null,
                "^src/data/.+ServiceContribution\\.java$",
                "runtime registration adapters may legitimately stay thin");

        private static final List<Role> SUBSTANTIVE_ROLES = List.of(
                DOMAIN_SERVICE,
                DOMAIN_POLICY,
                DOMAIN_FACTORY);
        private static final List<Role> CANDIDATE_ROLES = List.of(
                DOMAIN_APPLICATION_SERVICE,
                DOMAIN_USE_CASE,
                VIEW_BINDER,
                VIEW_INTENT_HANDLER,
                DATA_SERVICE_CONTRIBUTION);

        private final String label;
        private final String blockerExpectation;
        private final Pattern sourcePattern;
        private final String reportOnlyReason;

        Role(String label, String blockerExpectation, String sourcePattern, String reportOnlyReason) {
            this.label = label;
            this.blockerExpectation = blockerExpectation;
            this.sourcePattern = Pattern.compile(sourcePattern);
            this.reportOnlyReason = reportOnlyReason;
        }

        public String label() {
            return label;
        }

        public String blockerExpectation() {
            return blockerExpectation;
        }

        public String reportOnlyReason() {
            return reportOnlyReason;
        }

        boolean matches(SaltMarcherSourceFacts sourceFacts) {
            return sourceFacts.isUnderMainSourceRoots()
                    && sourcePattern.matcher(sourceFacts.relativePath()).matches();
        }
    }

    public record Analysis(boolean ceremonial, String collaboratorTarget, List<String> trivialDescriptions) {

        static Analysis notCeremonial() {
            return new Analysis(false, "", List.of());
        }
    }

    private record MethodShape(String description, String externalTarget) {
    }
}
