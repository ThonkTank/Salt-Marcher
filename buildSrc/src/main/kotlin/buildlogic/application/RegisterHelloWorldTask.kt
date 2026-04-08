package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerHelloWorldTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "helloWorld",
        "Run a tiny sample feature entrypoint that proves new source files can satisfy the current build checks. Pass --args='Name' to override the greeting target.",
        "features.hello.HelloObject\$Main"
    )
