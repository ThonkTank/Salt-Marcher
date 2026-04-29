import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.JavaExec
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/viewintenthandler-enforcement/build-harness/src/main/java")
}

tasks.register<JavaExec>("viewIntentHandlerTopologyCheck") {
    group = "verification"
    description = "Run only the ViewIntentHandler build-harness topology rules."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.view.intenthandler.ViewIntentHandlerTopologyCheckMain"
    args = listOf(projectDir.parentFile.parentFile.parentFile.absolutePath)
}
