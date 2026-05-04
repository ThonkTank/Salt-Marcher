package saltmarcher.buildlogic.verification

import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

open class VerificationLifecycleExtension(
    val productionBuild: TaskProvider<out Task>,
    val checkQualityHygiene: TaskProvider<out Task>,
    val checkArchitecture: TaskProvider<out Task>,
    val checkViewArchitecture: TaskProvider<out Task>,
    val ckjmMain: TaskProvider<out Task>,
    val check: TaskProvider<out Task>
)
