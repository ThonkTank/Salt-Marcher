package saltmarcher.buildlogic.tasks

import java.io.File
import java.io.Serializable
import org.gradle.api.Action
import org.gradle.api.GradleException
import org.gradle.api.Task

class PrepareHarnessRuntimeDirectoriesAction(
    private val xdgDataHomePath: String,
    private val resultsDirectoryPath: String? = null
) : Action<Task>, Serializable {

    override fun execute(task: Task) {
        val xdgDataHome = File(xdgDataHomePath)
        recreateDirectory(xdgDataHome)
        ensureDirectory(File(xdgDataHome, "salt-marcher"))

        resultsDirectoryPath
            ?.let(::File)
            ?.let(::recreateDirectory)
    }

    private fun recreateDirectory(directory: File) {
        if (directory.exists() && !directory.deleteRecursively()) {
            throw GradleException("Failed to delete ${directory.path}.")
        }
        ensureDirectory(directory)
    }

    private fun ensureDirectory(directory: File) {
        if (!directory.mkdirs() && !directory.isDirectory) {
            throw GradleException("Failed to create ${directory.path}.")
        }
    }
}
