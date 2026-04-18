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
        javaSourceFiles.files.asSequence()
            .filter { it.isFile && it.extension == "java" }
            .forEach { file ->
                val usedSelectors = extractStyleClassLiterals(file.readText())
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

    private fun extractStyleClassLiterals(sourceText: String): Set<String> {
        val selectors = linkedSetOf<String>()
        var searchIndex = 0
        while (true) {
            val markerIndex = sourceText.indexOf(STYLE_CLASS_MARKER, searchIndex)
            if (markerIndex < 0) {
                return selectors
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
                return selectors
            }
            val arguments = sourceText.substring(cursor + 1, closingParenIndex)
            STRING_LITERAL_PATTERN.findAll(arguments)
                .map { match -> match.groupValues[1] }
                .filter(STYLE_CLASS_NAME_PATTERN::matches)
                .forEach(selectors::add)
            searchIndex = closingParenIndex + 1
        }
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

    companion object {
        private const val STYLE_CLASS_MARKER = "getStyleClass()"
        private val STYLE_CLASS_METHODS = setOf("add", "addAll", "remove", "removeAll", "setAll")
        private val STRING_LITERAL_PATTERN = Regex("\"((?:\\\\.|[^\"\\\\])*)\"")
        private val STYLE_CLASS_NAME_PATTERN = Regex("[a-z][a-z0-9-]*")
        private val CSS_SELECTOR_PATTERN = Regex("\\.([A-Za-z][A-Za-z0-9_-]*)")
    }
}
