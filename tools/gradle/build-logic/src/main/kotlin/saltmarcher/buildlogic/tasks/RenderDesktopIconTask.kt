package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.work.DisableCachingByDefault
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import javax.inject.Inject

@DisableCachingByDefault(because = "Uses an external ImageMagick installation from PATH.")
abstract class RenderDesktopIconTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceFile: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @get:Input
    abstract val outputRelativePath: Property<String>

    @get:Input
    abstract val commandName: Property<String>

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @TaskAction
    fun render() {
        val sourcePath = sourceFile.get().asFile.toPath()
        if (!Files.isRegularFile(sourcePath)) {
            throw GradleException("Desktop icon source is missing: ${sourcePath.toAbsolutePath()}")
        }

        val magickExecutable = resolveExecutableOnPath(commandName.get())
            ?: throw GradleException(
                "ImageMagick '${commandName.get()}' executable not found on PATH. " +
                    "Install ImageMagick to generate ${outputRelativePath.get()}."
            )
        val targetPath = outputDirectory.get().asFile.toPath().resolve(outputRelativePath.get())
        val outputBuffer = ByteArrayOutputStream()

        Files.createDirectories(targetPath.parent)
        val execResult = execOperations.exec {
            workingDir = projectRoot.get().asFile
            executable = magickExecutable
            args(
                "-background",
                "none",
                sourcePath.toString(),
                "-alpha",
                "on",
                "-resize",
                "256x256",
                targetPath.toString()
            )
            isIgnoreExitValue = true
            standardOutput = outputBuffer
            errorOutput = outputBuffer
        }

        if (execResult.exitValue != 0) {
            val outputText = outputBuffer.toString(Charsets.UTF_8).trim()
            val suffix = if (outputText.isBlank()) "" else "\n$outputText"
            throw GradleException("ImageMagick failed with exit code ${execResult.exitValue}.$suffix")
        }
    }
}
