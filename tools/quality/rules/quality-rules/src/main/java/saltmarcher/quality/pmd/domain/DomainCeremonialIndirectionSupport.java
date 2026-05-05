package saltmarcher.quality.pmd.domain;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class DomainCeremonialIndirectionSupport {

    private static final Pattern SERVICE_PATH_PATTERN =
            Pattern.compile("^src/domain/[^/]+/[^/]+/service/[^/]+\\.java$");
    private static final Pattern POLICY_PATH_PATTERN =
            Pattern.compile("^src/domain/[^/]+/[^/]+/policy/[^/]+\\.java$");
    private static final Pattern FACTORY_PATH_PATTERN =
            Pattern.compile("^src/domain/[^/]+/[^/]+/factory/[^/]+\\.java$");
    private static final Pattern CLASS_DECLARATION_TEMPLATE =
            Pattern.compile("\\bclass\\s+%s\\b");
    private static final Pattern REQUIRE_NON_NULL_STATEMENT = Pattern.compile(
            "^(?:[A-Za-z_][A-Za-z0-9_$.<>\\[\\]\\s]*\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*)?"
                    + "(?:(?:java\\.util\\.)?Objects\\.)?requireNonNull\\s*\\(.*\\)$",
            Pattern.DOTALL);
    private static final Pattern IF_NULL_GUARD_STATEMENT = Pattern.compile(
            "^if\\s*\\(\\s*[A-Za-z_][A-Za-z0-9_]*\\s*==\\s*null\\s*\\)\\s*throw\\s+new\\s+[A-Za-z_][A-Za-z0-9_$.]*\\s*\\(.*\\)$",
            Pattern.DOTALL);
    private static final Pattern METHOD_NAME_PATTERN =
            Pattern.compile("([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    private static final Pattern TRIVIAL_NEW_STATEMENT = Pattern.compile(
            "^return\\s+new\\s+([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\([^()]*\\)$",
            Pattern.DOTALL);
    private static final Pattern TRIVIAL_CALL_STATEMENT = Pattern.compile(
            "^(?:return\\s+)?([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\([^()]*\\)$",
            Pattern.DOTALL);

    private DomainCeremonialIndirectionSupport() {
    }

    static boolean isServiceSource(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.isUnderMainSourceRoots()
                && SERVICE_PATH_PATTERN.matcher(sourceFacts.relativePath()).matches();
    }

    static boolean isPolicySource(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.isUnderMainSourceRoots()
                && POLICY_PATH_PATTERN.matcher(sourceFacts.relativePath()).matches();
    }

    static boolean isFactorySource(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.isUnderMainSourceRoots()
                && FACTORY_PATH_PATTERN.matcher(sourceFacts.relativePath()).matches();
    }

    static Analysis analyze(SaltMarcherSourceFacts sourceFacts) {
        String classBody = extractTopLevelClassBody(sourceFacts.text(), sourceFacts.simpleName());
        if (classBody == null) {
            return Analysis.notCeremonial();
        }

        List<MethodBody> methods = extractTopLevelMethods(classBody, sourceFacts.simpleName());
        List<MethodBody> nonConstructors = methods.stream()
                .filter(method -> !method.constructor())
                .toList();
        if (nonConstructors.isEmpty()) {
            return Analysis.notCeremonial();
        }

        Set<String> localMethodNames = new LinkedHashSet<>();
        for (MethodBody method : nonConstructors) {
            localMethodNames.add(method.name());
        }

        Set<String> collaboratorTargets = new LinkedHashSet<>();
        List<String> trivialDescriptions = new ArrayList<>();
        for (MethodBody method : nonConstructors) {
            TrivialMethodShape shape = classify(method, localMethodNames);
            if (shape == null) {
                return Analysis.notCeremonial();
            }
            if (shape.externalTarget() != null) {
                collaboratorTargets.add(shape.externalTarget());
            }
            trivialDescriptions.add(method.name() + " -> " + shape.description());
        }

        if (collaboratorTargets.isEmpty() || collaboratorTargets.size() > 1) {
            return Analysis.notCeremonial();
        }
        return new Analysis(true, collaboratorTargets.iterator().next(), trivialDescriptions);
    }

    private static String extractTopLevelClassBody(String text, String simpleName) {
        Pattern classPattern = Pattern.compile(String.format(
                CLASS_DECLARATION_TEMPLATE.pattern(),
                Pattern.quote(simpleName)));
        Matcher matcher = classPattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        int bodyStart = text.indexOf('{', matcher.end());
        if (bodyStart < 0) {
            return null;
        }
        int bodyEnd = matchingBraceIndex(text, bodyStart);
        if (bodyEnd < 0) {
            return null;
        }
        return text.substring(bodyStart + 1, bodyEnd);
    }

    private static int matchingBraceIndex(String text, int openBraceIndex) {
        int depth = 0;
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = openBraceIndex; index < text.length(); index++) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    index++;
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                continue;
            }
            if (current == '\'') {
                inChar = true;
                continue;
            }
            if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0) {
                    return index;
                }
            }
        }
        return -1;
    }

    private static List<MethodBody> extractTopLevelMethods(String classBody, String simpleName) {
        List<MethodBody> methods = new ArrayList<>();
        int index = 0;
        while (index < classBody.length()) {
            index = skipWhitespace(classBody, index);
            if (index >= classBody.length()) {
                break;
            }
            int memberStart = index;
            ScanResult result = scanTopLevelMember(classBody, memberStart);
            if (result == null) {
                break;
            }
            index = result.nextIndex();
            if (!result.header().contains("(") || result.header().startsWith("class ")
                    || result.header().contains(" class ")
                    || result.header().contains(" interface ")
                    || result.header().contains(" record ")
                    || result.header().contains(" enum ")) {
                continue;
            }
            String methodName = extractMethodName(result.header());
            if (methodName == null) {
                continue;
            }
            methods.add(new MethodBody(methodName, methodName.equals(simpleName), result.body()));
        }
        return methods;
    }

    private static int skipWhitespace(String text, int index) {
        int current = index;
        while (current < text.length() && Character.isWhitespace(text.charAt(current))) {
            current++;
        }
        return current;
    }

    private static ScanResult scanTopLevelMember(String classBody, int memberStart) {
        int depth = 0;
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        int bodyStart = -1;
        for (int index = memberStart; index < classBody.length(); index++) {
            char current = classBody.charAt(index);
            char next = index + 1 < classBody.length() ? classBody.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    index++;
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                continue;
            }
            if (current == '\'') {
                inChar = true;
                continue;
            }
            if (current == ';' && depth == 0) {
                return new ScanResult(classBody.substring(memberStart, index + 1).trim(), "", index + 1);
            }
            if (current == '{') {
                if (depth == 0) {
                    bodyStart = index;
                }
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0 && bodyStart >= 0) {
                    String header = classBody.substring(memberStart, bodyStart).trim();
                    String body = classBody.substring(bodyStart + 1, index);
                    return new ScanResult(header, body, index + 1);
                }
            }
        }
        return null;
    }

    private static String extractMethodName(String header) {
        Matcher matcher = METHOD_NAME_PATTERN.matcher(header);
        String methodName = null;
        while (matcher.find()) {
            methodName = matcher.group(1);
        }
        return methodName;
    }

    private static TrivialMethodShape classify(MethodBody method, Set<String> localMethodNames) {
        String sanitizedBody = stripCommentsAndStrings(method.body()).trim();
        if (sanitizedBody.isBlank()) {
            return null;
        }
        if (containsTopLevelControlFlow(sanitizedBody)) {
            return null;
        }
        List<String> statements = topLevelStatements(sanitizedBody);
        if (statements.isEmpty()) {
            return null;
        }

        List<String> effectiveStatements = new ArrayList<>();
        for (String statement : statements) {
            if (REQUIRE_NON_NULL_STATEMENT.matcher(statement).matches()
                    || IF_NULL_GUARD_STATEMENT.matcher(statement).matches()) {
                continue;
            }
            effectiveStatements.add(statement);
        }

        if (effectiveStatements.size() != 1) {
            return null;
        }

        String statement = effectiveStatements.getFirst();
        Matcher newMatcher = TRIVIAL_NEW_STATEMENT.matcher(statement);
        if (newMatcher.matches() && statement.chars().filter(ch -> ch == '(').count() == 1L) {
            return new TrivialMethodShape("wraps constructor " + newMatcher.group(1), "new:" + newMatcher.group(1));
        }

        Matcher callMatcher = TRIVIAL_CALL_STATEMENT.matcher(statement);
        if (!callMatcher.matches() || statement.chars().filter(ch -> ch == '(').count() != 1L) {
            return null;
        }
        String callee = callMatcher.group(1);
        if (callee.contains(").") || callee.startsWith("new ")) {
            return null;
        }
        String externalTarget = externalTarget(callee, localMethodNames);
        String description = statement.startsWith("return ")
                ? "returns delegated call " + callee + "(...)"
                : "forwards delegated call " + callee + "(...)";
        return new TrivialMethodShape(description, externalTarget);
    }

    private static boolean containsTopLevelControlFlow(String text) {
        int depth = 0;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        StringBuilder topLevel = new StringBuilder(text.length());
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            if (escaped) {
                escaped = false;
                if (depth == 0) {
                    topLevel.append(' ');
                }
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                if (depth == 0) {
                    topLevel.append(' ');
                }
                continue;
            }
            if (current == '"' && !inChar) {
                inString = !inString;
                if (depth == 0) {
                    topLevel.append(' ');
                }
                continue;
            }
            if (current == '\'' && !inString) {
                inChar = !inChar;
                if (depth == 0) {
                    topLevel.append(' ');
                }
                continue;
            }
            if (inString || inChar) {
                if (depth == 0) {
                    topLevel.append(' ');
                }
                continue;
            }
            if (current == '{') {
                depth++;
                continue;
            }
            if (current == '}') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (depth == 0) {
                topLevel.append(current);
            }
        }
        String normalized = topLevel.toString().replaceAll("\\s+", " ");
        return normalized.contains(" if ")
                || normalized.startsWith("if ")
                || normalized.contains(" for ")
                || normalized.startsWith("for ")
                || normalized.contains(" while ")
                || normalized.startsWith("while ")
                || normalized.contains(" switch ")
                || normalized.startsWith("switch ")
                || normalized.contains(" try ")
                || normalized.startsWith("try ")
                || normalized.contains(" catch ")
                || normalized.contains(" synchronized ")
                || normalized.startsWith("synchronized ");
    }

    private static List<String> topLevelStatements(String text) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int depth = 0;
        for (int index = 0; index < text.length(); index++) {
            char character = text.charAt(index);
            if (character == '(') {
                depth++;
            } else if (character == ')') {
                depth = Math.max(0, depth - 1);
            } else if ((character == '{' || character == '}') && depth == 0) {
                return List.of();
            }
            if (character == ';' && depth == 0) {
                String statement = current.toString().trim();
                if (!statement.isBlank()) {
                    statements.add(statement);
                }
                current.setLength(0);
                continue;
            }
            current.append(character);
        }
        String trailing = current.toString().trim();
        if (!trailing.isBlank()) {
            statements.add(trailing);
        }
        return statements;
    }

    private static String externalTarget(String callee, Set<String> localMethodNames) {
        String methodName = callee.contains(".")
                ? callee.substring(callee.lastIndexOf('.') + 1)
                : callee;
        if (localMethodNames.contains(methodName)) {
            return null;
        }
        int lastDot = callee.lastIndexOf('.');
        if (lastDot > 0) {
            return callee.substring(0, lastDot);
        }
        return callee;
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

    record Analysis(boolean ceremonial, String collaboratorTarget, List<String> trivialDescriptions) {

        static Analysis notCeremonial() {
            return new Analysis(false, "", List.of());
        }
    }

    private record MethodBody(String name, boolean constructor, String body) {
    }

    private record ScanResult(String header, String body, int nextIndex) {
    }

    private record TrivialMethodShape(String description, String externalTarget) {
    }
}
