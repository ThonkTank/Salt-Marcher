package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault
import java.io.File

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class CheckDefinedStyleClassSelectorsTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val javaSourceFiles: ConfigurableFileCollection

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val stylesheetFiles: ConfigurableFileCollection

    @TaskAction
    fun checkDefinedSelectors() {
        val definedSelectors = stylesheetFiles.files.asSequence()
            .filter(File::isFile)
            .flatMap { file ->
                CSS_SELECTOR_PATTERN.findAll(file.readText()).map { match -> match.groupValues[1] }
            }
            .toSet()

        val missingSelectors = linkedMapOf<String, MutableSet<String>>()
        val sourceTexts = javaSourceFiles.files.asSequence()
            .filter { it.isFile && it.extension == "java" }
            .associateWith { file -> file.readText() }
        val helperMethods = resolveStyleClassHelperMethods(sourceTexts.values)
        sourceTexts.forEach { (file, sourceText) ->
            val usedSelectors = extractStyleClassLiterals(sourceText, helperMethods)
            val missing = usedSelectors.filterNot(definedSelectors::contains)
            if (missing.isNotEmpty()) {
                missingSelectors[file.relativeTo(project.projectDir).invariantSeparatorsPath] = missing.toMutableSet()
            }
        }

        if (missingSelectors.isNotEmpty()) {
            val details = missingSelectors.entries.joinToString(separator = "\n") { (path, selectors) ->
                " - $path -> ${selectors.joinToString(", ")}"
            }
            throw GradleException(
                "Style classes used from Java must resolve to centralized selectors in resources/*.css.\n" +
                    "Add the missing selectors to a centralized stylesheet or stop using them from code.\n" +
                    "Missing selectors:\n$details"
            )
        }
    }

    private fun extractStyleClassLiterals(
        sourceText: String,
        helperMethods: Map<MethodKey, Set<Int>>
    ): Set<String> {
        val selectors = linkedSetOf<String>()
        collectStyleClassCallLiterals(sourceText, selectors)
        collectHelperCallLiterals(sourceText, helperMethods, selectors)
        return selectors
    }

    private fun collectStyleClassCallLiterals(sourceText: String, selectors: MutableSet<String>) {
        var searchIndex = 0
        while (true) {
            val markerIndex = sourceText.indexOf(STYLE_CLASS_MARKER, searchIndex)
            if (markerIndex < 0) {
                return
            }
            var cursor = markerIndex + STYLE_CLASS_MARKER.length
            while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
                cursor++
            }
            if (cursor >= sourceText.length || sourceText[cursor] != '.') {
                searchIndex = markerIndex + STYLE_CLASS_MARKER.length
                continue
            }
            cursor++
            val methodStart = cursor
            while (cursor < sourceText.length && Character.isJavaIdentifierPart(sourceText[cursor])) {
                cursor++
            }
            val methodName = sourceText.substring(methodStart, cursor)
            if (methodName !in STYLE_CLASS_METHODS) {
                searchIndex = markerIndex + STYLE_CLASS_MARKER.length
                continue
            }
            while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
                cursor++
            }
            if (cursor >= sourceText.length || sourceText[cursor] != '(') {
                searchIndex = markerIndex + STYLE_CLASS_MARKER.length
                continue
            }
            val closingParenIndex = findClosingParen(sourceText, cursor)
            if (closingParenIndex < 0) {
                return
            }
            val arguments = sourceText.substring(cursor + 1, closingParenIndex)
            STRING_LITERAL_PATTERN.findAll(arguments)
                .map { match -> match.groupValues[1] }
                .filter(STYLE_CLASS_NAME_PATTERN::matches)
                .forEach(selectors::add)
            searchIndex = closingParenIndex + 1
        }
    }

    private fun resolveStyleClassHelperMethods(sourceTexts: Iterable<String>): Map<MethodKey, Set<Int>> {
        val methods = sourceTexts.flatMap(::parseMethods)
        val styleParameterIndexesByMethod = linkedMapOf<MethodKey, MutableSet<Int>>()
        for (method in methods) {
            val directIndexes = directStyleParameterIndexes(method)
            if (directIndexes.isNotEmpty()) {
                styleParameterIndexesByMethod.getOrPut(method.key) { linkedSetOf() }.addAll(directIndexes)
            }
        }

        var changed = true
        while (changed) {
            changed = false
            for (method in methods) {
                val currentIndexes = styleParameterIndexesByMethod.getOrPut(method.key) { linkedSetOf() }
                for (call in parseCalls(method.body)) {
                    val calleeStyleIndexes = styleParameterIndexesByMethod[call.key].orEmpty()
                    for (calleeStyleIndex in calleeStyleIndexes) {
                        val argument = call.arguments.getOrNull(calleeStyleIndex)?.trim() ?: continue
                        val parameterIndex = method.parameters.indexOf(argument)
                        if (parameterIndex >= 0 && currentIndexes.add(parameterIndex)) {
                            changed = true
                        }
                    }
                }
            }
        }

        return styleParameterIndexesByMethod
            .filterValues { it.isNotEmpty() }
            .mapValues { (_, indexes) -> indexes.toSet() }
    }

    private fun directStyleParameterIndexes(method: MethodDefinition): Set<Int> {
        val indexes = linkedSetOf<Int>()
        val styleClassCalls = styleClassCallArguments(method.body)
        for (arguments in styleClassCalls) {
            for (argument in arguments) {
                val parameterIndex = method.parameters.indexOf(argument.trim())
                if (parameterIndex >= 0) {
                    indexes.add(parameterIndex)
                }
            }
        }
        return indexes
    }

    private fun collectHelperCallLiterals(
        sourceText: String,
        helperMethods: Map<MethodKey, Set<Int>>,
        selectors: MutableSet<String>
    ) {
        for (call in parseCalls(sourceText)) {
            val styleIndexes = helperMethods[call.key].orEmpty()
            for (styleIndex in styleIndexes) {
                val argument = call.arguments.getOrNull(styleIndex) ?: continue
                STRING_LITERAL_PATTERN.findAll(argument)
                    .map { match -> match.groupValues[1] }
                    .filter(STYLE_CLASS_NAME_PATTERN::matches)
                    .forEach(selectors::add)
            }
        }
    }

    private fun parseMethods(sourceText: String): List<MethodDefinition> {
        val methods = mutableListOf<MethodDefinition>()
        for (match in METHOD_DECLARATION_PATTERN.findAll(sourceText)) {
            val bodyStart = match.range.last
            val bodyEnd = findClosingBrace(sourceText, bodyStart)
            if (bodyEnd < 0) {
                continue
            }
            val name = match.groupValues[1]
            val parameters = parseParameterNames(match.groupValues[2])
            val body = sourceText.substring(bodyStart + 1, bodyEnd)
            methods.add(MethodDefinition(name, parameters, body))
        }
        return methods
    }

    private fun parseParameterNames(parameterText: String): List<String> {
        if (parameterText.isBlank()) {
            return emptyList()
        }
        return splitArguments(parameterText)
            .mapNotNull { parameter ->
                PARAMETER_NAME_PATTERN.find(parameter.trim())?.groupValues?.get(1)
            }
    }

    private fun styleClassCallArguments(sourceText: String): List<List<String>> {
        val calls = mutableListOf<List<String>>()
        var searchIndex = 0
        while (true) {
            val markerIndex = sourceText.indexOf(STYLE_CLASS_MARKER, searchIndex)
            if (markerIndex < 0) {
                return calls
            }
            var cursor = markerIndex + STYLE_CLASS_MARKER.length
            while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
                cursor++
            }
            if (cursor >= sourceText.length || sourceText[cursor] != '.') {
                searchIndex = markerIndex + STYLE_CLASS_MARKER.length
                continue
            }
            cursor++
            val methodStart = cursor
            while (cursor < sourceText.length && Character.isJavaIdentifierPart(sourceText[cursor])) {
                cursor++
            }
            val methodName = sourceText.substring(methodStart, cursor)
            if (methodName !in STYLE_CLASS_METHODS) {
                searchIndex = markerIndex + STYLE_CLASS_MARKER.length
                continue
            }
            while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
                cursor++
            }
            if (cursor >= sourceText.length || sourceText[cursor] != '(') {
                searchIndex = markerIndex + STYLE_CLASS_MARKER.length
                continue
            }
            val closingParenIndex = findClosingParen(sourceText, cursor)
            if (closingParenIndex < 0) {
                return calls
            }
            calls.add(splitArguments(sourceText.substring(cursor + 1, closingParenIndex)))
            searchIndex = closingParenIndex + 1
        }
    }

    private fun parseCalls(sourceText: String): List<MethodCall> {
        val calls = mutableListOf<MethodCall>()
        for (match in METHOD_CALL_PATTERN.findAll(sourceText)) {
            val openingParenIndex = match.range.last
            val closingParenIndex = findClosingParen(sourceText, openingParenIndex)
            if (closingParenIndex < 0) {
                continue
            }
            val name = match.groupValues[1]
            val arguments = splitArguments(sourceText.substring(openingParenIndex + 1, closingParenIndex))
            calls.add(MethodCall(name, arguments))
        }
        return calls
    }

    private fun splitArguments(arguments: String): List<String> {
        val result = mutableListOf<String>()
        var depth = 0
        var inString = false
        var escaped = false
        var start = 0
        for (index in arguments.indices) {
            val character = arguments[index]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (character == '\\') {
                    escaped = true
                } else if (character == '"') {
                    inString = false
                }
                continue
            }
            when (character) {
                '"' -> inString = true
                '(', '[', '<' -> depth++
                ')', ']', '>' -> if (depth > 0) {
                    depth--
                }
                ',' -> if (depth == 0) {
                    result.add(arguments.substring(start, index).trim())
                    start = index + 1
                }
            }
        }
        val last = arguments.substring(start).trim()
        if (last.isNotEmpty()) {
            result.add(last)
        }
        return result
    }

    private fun findClosingParen(sourceText: String, openingParenIndex: Int): Int {
        var depth = 0
        var inString = false
        var escaped = false
        for (index in openingParenIndex until sourceText.length) {
            val character = sourceText[index]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (character == '\\') {
                    escaped = true
                } else if (character == '"') {
                    inString = false
                }
                continue
            }
            when (character) {
                '"' -> inString = true
                '(' -> depth++
                ')' -> {
                    depth--
                    if (depth == 0) {
                        return index
                    }
                }
            }
        }
        return -1
    }

    private fun findClosingBrace(sourceText: String, openingBraceIndex: Int): Int {
        var depth = 0
        var inString = false
        var escaped = false
        for (index in openingBraceIndex until sourceText.length) {
            val character = sourceText[index]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (character == '\\') {
                    escaped = true
                } else if (character == '"') {
                    inString = false
                }
                continue
            }
            when (character) {
                '"' -> inString = true
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) {
                        return index
                    }
                }
            }
        }
        return -1
    }

    private data class MethodDefinition(
        val name: String,
        val parameters: List<String>,
        val body: String
    ) {
        val key = MethodKey(name, parameters.size)
    }

    private data class MethodCall(
        val name: String,
        val arguments: List<String>
    ) {
        val key = MethodKey(name, arguments.size)
    }

    private data class MethodKey(
        val name: String,
        val arity: Int
    )

    companion object {
        private const val STYLE_CLASS_MARKER = "getStyleClass()"
        private val STYLE_CLASS_METHODS = setOf("add", "addAll", "remove", "removeAll", "setAll")
        private val METHOD_DECLARATION_PATTERN = Regex(
            "(?m)^\\s*(?:public|protected|private)?\\s*(?:static\\s+)?(?:final\\s+)?[\\w<>\\[\\].?,\\s]+\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(([^()]*)\\)\\s*\\{"
        )
        private val METHOD_CALL_PATTERN = Regex("\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\(")
        private val PARAMETER_NAME_PATTERN = Regex("([A-Za-z_][A-Za-z0-9_]*)\\s*$")
        private val STRING_LITERAL_PATTERN = Regex("\"((?:\\\\.|[^\"\\\\])*)\"")
        private val STYLE_CLASS_NAME_PATTERN = Regex("[a-z][a-z0-9-]*")
        private val CSS_SELECTOR_PATTERN = Regex("\\.([A-Za-z][A-Za-z0-9_-]*)")
    }
}
