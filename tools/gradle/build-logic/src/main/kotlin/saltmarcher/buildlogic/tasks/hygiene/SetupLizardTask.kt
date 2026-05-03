package saltmarcher.buildlogic.tasks.hygiene

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
import org.gradle.api.file.FileSystemOperations
import org.gradle.process.ExecOperations
import org.gradle.work.DisableCachingByDefault
import java.io.IOException
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import javax.inject.Inject
import saltmarcher.buildlogic.tasks.resolveVenvPythonExecutable

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
        val expectedMarker = Files.readString(requirementsPath)
        val lockFilePath = venvPath.parent.resolve(".setup.lock")

        Files.createDirectories(lockFilePath.parent)
        FileChannel.open(lockFilePath, StandardOpenOption.CREATE, StandardOpenOption.WRITE).use { channel ->
            channel.lock().use {
                if (venvIsFresh(venvPath, readyMarkerPath, expectedMarker)) {
                    return
                }

                val tempVenvPath = venvPath.resolveSibling("${venvPath.fileName}.tmp-${System.nanoTime()}")
                fileSystemOperations.delete {
                    delete(tempVenvPath.toFile())
                }

                try {
                    execOperations.exec {
                        workingDir = projectRoot.get().asFile
                        executable = pythonCommand.get()
                        args("-m", "venv", tempVenvPath.toString())
                    }

                    val venvPython = resolveVenvPythonExecutable(tempVenvPath)
                    execOperations.exec {
                        workingDir = projectRoot.get().asFile
                        executable = venvPython.toString()
                        args("-m", "pip", "install", "--requirement", requirementsPath.toString())
                    }

                    val tempReadyMarkerPath = tempVenvPath.resolve(readyMarkerPath.fileName)
                    Files.createDirectories(tempReadyMarkerPath.parent)
                    Files.writeString(tempReadyMarkerPath, expectedMarker)

                    if (!venvIsFresh(venvPath, readyMarkerPath, expectedMarker)) {
                        fileSystemOperations.delete {
                            delete(venvPath.toFile())
                        }
                    }

                    try {
                        Files.createDirectories(venvPath.parent)
                        Files.move(tempVenvPath, venvPath, StandardCopyOption.ATOMIC_MOVE)
                    } catch (_: IOException) {
                        Files.move(tempVenvPath, venvPath, StandardCopyOption.REPLACE_EXISTING)
                    }
                } finally {
                    fileSystemOperations.delete {
                        delete(tempVenvPath.toFile())
                    }
                }
            }
        }
    }

    private fun venvIsFresh(venvPath: Path, readyMarkerPath: Path, expectedMarker: String): Boolean {
        val venvPythonPath = expectedVenvPythonPath(venvPath)
        return Files.isRegularFile(readyMarkerPath)
            && Files.isRegularFile(venvPythonPath)
            && Files.readString(readyMarkerPath) == expectedMarker
    }

    private fun expectedVenvPythonPath(venvPath: Path): Path {
        return if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
            venvPath.resolve("Scripts").resolve("python.exe")
        } else {
            venvPath.resolve("bin").resolve("python")
        }
    }
}
