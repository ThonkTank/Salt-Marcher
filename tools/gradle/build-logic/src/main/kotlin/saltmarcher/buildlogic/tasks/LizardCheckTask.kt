package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.work.DisableCachingByDefault
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import javax.inject.Inject

@DisableCachingByDefault(because = "Verification task whose result is a pass/fail report.")
abstract class LizardCheckTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceRoots: ConfigurableFileCollection

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val requirementsMarker: RegularFileProperty

    @get:Input
    abstract val maxCyclomaticComplexity: Property<Int>

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:Internal
    abstract val venvDirectory: DirectoryProperty

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @TaskAction
    fun runLizard() {
        val venvPython = resolveVenvPythonExecutable(venvDirectory.get().asFile.toPath())
        val reportPath = reportFile.get().asFile.toPath()
        val outputBuffer = ByteArrayOutputStream()
        val projectRootPath = projectRoot.get().asFile.toPath()
        val sourceDirs = sourceRoots.files
            .map { file -> projectRootPath.relativize(file.toPath()).toString().replace('\\', '/') }
            .sorted()

        val execResult = execOperations.exec {
            workingDir = projectRoot.get().asFile
            executable = venvPython.toString()
            args("-m", "lizard", "-l", "java", "-C", maxCyclomaticComplexity.get().toString())
            args(sourceDirs.toList())
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }

        val outputText = outputBuffer.toString(Charsets.UTF_8)
        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, outputText)

        if (execResult.exitValue != 0 && outputText.isNotBlank()) {
            println(outputText.trimEnd())
        }

        if (execResult.exitValue != 0) {
            throw GradleException(
                "Lizard complexity violations were found. See the report at: file://${reportPath.toAbsolutePath()}"
            )
        }
    }
}
