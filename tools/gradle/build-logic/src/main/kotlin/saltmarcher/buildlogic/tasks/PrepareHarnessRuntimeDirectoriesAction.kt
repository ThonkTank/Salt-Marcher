package saltmarcher.buildlogic.tasks

import java.io.File
import java.io.Serializable
import org.gradle.api.Action
import org.gradle.api.GradleException
import org.gradle.api.Task

class PrepareHarnessRuntimeDirectoriesAction(
    private val xdgDataHomePath: String,
    private val gradleManagedRootPath: String,
    private val resultsDirectoryPath: String? = null
) : Action<Task>, Serializable {

    override fun execute(task: Task) {
        val gradleManagedRoot = File(gradleManagedRootPath).canonicalFile
        val xdgDataHome = File(xdgDataHomePath)
        ensureGradleManaged(xdgDataHome, gradleManagedRoot, "XDG_DATA_HOME")
        recreateDirectory(xdgDataHome)
        ensureDirectory(File(xdgDataHome, "salt-marcher"))

        resultsDirectoryPath
            ?.let(::File)
            ?.also { resultsDirectory -> ensureGradleManaged(resultsDirectory, gradleManagedRoot, "results directory") }
            ?.let(::recreateDirectory)

        if (traceEnabled()) {
            task.logger.lifecycle(
                traceMessage("start", task, xdgDataHome, resultsDirectoryPath?.let(::File))
            )
        }
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

    private fun ensureGradleManaged(directory: File, gradleManagedRoot: File, label: String) {
        val canonicalDirectory = directory.canonicalFile.toPath()
        if (!canonicalDirectory.startsWith(gradleManagedRoot.toPath())) {
            throw GradleException(
                "Harness $label must stay under Gradle-managed build directory ${gradleManagedRoot.path}: " +
                    directory.path
            )
        }
    }
}

class FinishHarnessRuntimeDirectoriesAction(
    private val xdgDataHomePath: String,
    private val resultsDirectoryPath: String? = null
) : Action<Task>, Serializable {

    override fun execute(task: Task) {
        if (traceEnabled()) {
            task.logger.lifecycle(
                traceMessage("end", task, File(xdgDataHomePath), resultsDirectoryPath?.let(::File))
            )
        }
    }
}

private fun traceEnabled(): Boolean =
    System.getProperty("saltmarcher.traceHarnessRuntime").equals("true", ignoreCase = true)

private fun traceMessage(
    phase: String,
    task: Task,
    xdgDataHome: File,
    resultsDirectory: File?
): String =
    "[saltmarcher-harness-runtime] phase=$phase task=${task.path} monotonicNanos=${System.nanoTime()} " +
        "xdgDataHome=${xdgDataHome.absolutePath} resultsDirectory=${resultsDirectory?.absolutePath ?: "<none>"}"
