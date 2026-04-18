package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.work.DisableCachingByDefault
import java.io.File
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import javax.inject.Inject

@DisableCachingByDefault(because = "Verification task whose result is a generated report.")
abstract class CkjmReportTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClasses: ConfigurableFileCollection

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:Classpath
    abstract val runtimeClasspath: ConfigurableFileCollection

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:OutputFile
    abstract val summaryFile: RegularFileProperty

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @TaskAction
    fun runCkjm() {
        val reportPath = reportFile.get().asFile.toPath()
        val summaryPath = summaryFile.get().asFile.toPath()
        val classFiles = compiledClasses.asFileTree
            .matching { include("**/*.class") }
            .files
            .map { it.toPath().toString() }
            .sorted()

        Files.createDirectories(reportPath.parent)
        if (classFiles.isEmpty()) {
            Files.writeString(reportPath, "")
            Files.writeString(summaryPath, "# CKJM Summary\n\nNo compiled production classes were found.\n")
            return
        }

        val outputBuffer = ByteArrayOutputStream()
        val execResult = execOperations.exec {
            workingDir = projectRoot.get().asFile
            executable = resolveJavaExecutable().toString()
            val ckjmClasspath = (toolClasspath.files + runtimeClasspath.files + compiledClasses.files)
                .distinct()
                .joinToString(File.pathSeparator)
            args("-cp", ckjmClasspath)
            args("gr.spinellis.ckjm.MetricsFilter")
            args(classFiles)
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }

        val outputText = outputBuffer.toString(Charsets.UTF_8)
        Files.writeString(reportPath, outputText)
        Files.writeString(summaryPath, summarizeCkjmOutput(outputText))

        if (execResult.exitValue != 0) {
            val suffix = if (outputText.isBlank()) "" else "\n${outputText.trimEnd()}"
            throw GradleException("CKJM ext failed with exit code ${execResult.exitValue}.$suffix")
        }
    }
}
