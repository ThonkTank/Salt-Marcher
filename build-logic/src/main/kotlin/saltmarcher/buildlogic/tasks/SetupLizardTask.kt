package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import org.gradle.api.file.FileSystemOperations
import org.gradle.work.DisableCachingByDefault
import java.nio.file.Files
import javax.inject.Inject

@DisableCachingByDefault(because = "Bootstraps an external Python toolchain in the build directory.")
abstract class SetupLizardTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val requirementsFile: RegularFileProperty

    @get:OutputDirectory
    abstract val venvDirectory: DirectoryProperty

    @get:OutputFile
    abstract val readyMarker: RegularFileProperty

    @get:Input
    abstract val pythonCommand: Property<String>

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:Inject
    protected abstract val execOperations: ExecOperations

    @get:Inject
    protected abstract val fileSystemOperations: FileSystemOperations

    @TaskAction
    fun setup() {
        val requirementsPath = requirementsFile.get().asFile.toPath()
        val venvPath = venvDirectory.get().asFile.toPath()
        val readyMarkerPath = readyMarker.get().asFile.toPath()

        fileSystemOperations.delete {
            delete(venvDirectory)
        }

        execOperations.exec {
            workingDir = projectRoot.get().asFile
            executable = pythonCommand.get()
            args("-m", "venv", venvPath.toString())
        }

        val venvPython = resolveVenvPythonExecutable(venvPath)
        execOperations.exec {
            workingDir = projectRoot.get().asFile
            executable = venvPython.toString()
            args("-m", "pip", "install", "--requirement", requirementsPath.toString())
        }

        Files.createDirectories(readyMarkerPath.parent)
        Files.writeString(readyMarkerPath, Files.readString(requirementsPath))
    }
}
