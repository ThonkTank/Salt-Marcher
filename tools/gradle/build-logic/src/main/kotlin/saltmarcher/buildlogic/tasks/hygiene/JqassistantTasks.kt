package saltmarcher.buildlogic.tasks.hygiene

import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.Comparator
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import javax.inject.Inject

abstract class AbstractJqassistantTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val cliFile: RegularFileProperty

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceConfigFile: RegularFileProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rulesDirectory: DirectoryProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val mainClassesDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:Input
    abstract val jvmOpens: Property<String>

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    protected fun materializeConfig(reportRootOverride: java.io.File?): java.io.File {
        val mainClasspathEntry = "        - java:classpath::${mainClassesDirectory.get().asFile.absoluteInvariantPath()}"
        val tempReportRoot = reportRootOverride?.toPath() ?: temporaryDir.toPath().resolve("reports")
        val configText = sourceConfigFile.get().asFile.readText()
            .replace("file:build/jqassistant/store", "file:${temporaryDir.toPath().resolve("jqassistant-store").absoluteInvariantPath()}")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: ${tempReportRoot.resolve("jqassistant-report.xml").absoluteInvariantPath()}"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: ${tempReportRoot.resolve("junit").absoluteInvariantPath()}"
            )
        val generatedConfig = temporaryDir.toPath().resolve("jqassistant-config.yml")
        Files.createDirectories(generatedConfig.parent)
        Files.writeString(generatedConfig, configText)
        return generatedConfig.toFile()
    }

    protected fun runJqassistant(generatedConfigFile: java.io.File, vararg arguments: String) {
        val outputBuffer = ByteArrayOutputStream()
        val execResult = execOperations.exec {
            workingDir = projectRoot.get().asFile
            environment("JQASSISTANT_OPTS", jvmOpens.get())
            commandLine(
                "/bin/bash",
                cliFile.get().asFile.absolutePath,
                *arguments,
                "-C",
                generatedConfigFile.absolutePath
            )
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }
        if (execResult.exitValue != 0) {
            val outputText = outputBuffer.toString(Charsets.UTF_8).trim()
            val suffix = if (outputText.isBlank()) "" else "\n$outputText"
            throw VerificationException("jQAssistant failed with exit code ${execResult.exitValue}.$suffix")
        }
    }
}

@CacheableTask
abstract class JqassistantScanTask : AbstractJqassistantTask() {

    @get:OutputDirectory
    abstract val storeDirectory: DirectoryProperty

    @TaskAction
    fun scan() {
        val storeDir = storeDirectory.get().asFile
        Files.createDirectories(storeDir.toPath().parent)
        val generatedConfigFile = materializeConfig(null)
        runJqassistant(
            generatedConfigFile,
            "scan",
            "-D",
            "jqassistant.store.uri=file:${storeDir.absoluteInvariantPath()}"
        )
    }
}

@CacheableTask
abstract class JqassistantAnalyzeTask : AbstractJqassistantTask() {

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val storeDirectory: DirectoryProperty

    @get:OutputDirectory
    abstract val reportsDirectory: DirectoryProperty

    @TaskAction
    fun analyze() {
        val reportsDir = reportsDirectory.get().asFile
        if (reportsDir.exists()) {
            Files.walk(reportsDir.toPath())
                .sorted(Comparator.reverseOrder())
                .forEach(Files::deleteIfExists)
        }
        Files.createDirectories(reportsDir.toPath())
        Files.createDirectories(reportsDir.toPath().resolve("junit"))
        val generatedConfigFile = materializeConfig(reportsDir)
        runJqassistant(
            generatedConfigFile,
            "analyze",
            "-D",
            "jqassistant.store.uri=file:${storeDirectory.get().asFile.absoluteInvariantPath()}"
        )
    }
}

private fun java.nio.file.Path.absoluteInvariantPath(): String = toAbsolutePath().toString().replace('\\', '/')

private fun java.io.File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')
