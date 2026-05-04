package saltmarcher.buildlogic.tasks

import java.io.File
import java.nio.file.Files
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException

@CacheableTask
abstract class ValidateBugCheckerRegistriesTask : DefaultTask() {

    @get:Input
    abstract val registrySpecs: ListProperty<String>

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val registryInputFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun validate() {
        val markerPath = successMarker.get().asFile.toPath()
        Files.createDirectories(markerPath.parent)
        Files.deleteIfExists(markerPath)

        val failures = buildList {
            registrySpecs.get().forEach { spec ->
                val owner = spec.substringBefore('\t')
                val servicePath = File(spec.substringAfter('\t').substringBefore('\t'))
                val sourceDir = File(spec.substringAfterLast('\t'))

                val checkerFiles = sourceDir.walkTopDown()
                    .filter { file -> file.isFile && file.name.endsWith("Checker.java") }
                    .toList()
                if (checkerFiles.isEmpty()) {
                    return@forEach
                }

                val discoveredCheckers = checkerFiles
                    .map { checkerFile -> checkerClassName(sourceDir, checkerFile) }
                    .toSortedSet()
                val declaredCheckers = declaredCheckerClasses(servicePath).toSortedSet()

                val missingEntries = discoveredCheckers - declaredCheckers
                val staleEntries = declaredCheckers - discoveredCheckers
                if (missingEntries.isEmpty() && staleEntries.isEmpty()) {
                    return@forEach
                }

                val details = buildList {
                    if (missingEntries.isNotEmpty()) {
                        add("missing service entries: ${missingEntries.joinToString()}")
                    }
                    if (staleEntries.isNotEmpty()) {
                        add("stale service entries: ${staleEntries.joinToString()}")
                    }
                }.joinToString("; ")
                add("$owner BugChecker registry drift in $servicePath: $details")
            }
        }

        if (failures.isNotEmpty()) {
            throw VerificationException(
                failures.joinToString(
                    prefix = "Error Prone service registries must stay aligned with checker sources.\n",
                    separator = "\n"
                )
            )
        }

        Files.writeString(markerPath, "passed\n")
    }

    private fun checkerClassName(sourceDir: File, checkerFile: File): String = sourceDir.toPath()
        .relativize(checkerFile.toPath())
        .joinToString(".") { segment -> segment.toString() }
        .removeSuffix(".java")

    private fun declaredCheckerClasses(serviceFile: File): Set<String> = serviceFile.readLines()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toSet()
}

@CacheableTask
abstract class MergeBugCheckerServicesTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val serviceFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val mergedServiceFile: RegularFileProperty

    @TaskAction
    fun merge() {
        val mergedLines = linkedSetOf<String>()
        serviceFiles.files
            .sortedBy { it.invariantSeparatorsPath }
            .forEach { serviceFile ->
                serviceFile.readLines()
                    .map(String::trim)
                    .filter(String::isNotEmpty)
                    .forEach(mergedLines::add)
            }

        val target = mergedServiceFile.get().asFile.toPath()
        Files.createDirectories(target.parent)
        Files.writeString(
            target,
            mergedLines.joinToString(System.lineSeparator()) + System.lineSeparator()
        )
    }
}
