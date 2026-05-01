import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/domain-aggregate-enforcement/build-harness/src/main/java")
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?: projectDir.parentFile.parentFile.parentFile.absolutePath

tasks.register<JavaExec>("domainAggregateEnforcementDocumentationCheck") {
    group = "verification"
    description = "Run only the Domain Aggregate enforcement documentation-coverage rules."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Documentation enforcement diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.documentation.domainaggregate.DomainAggregateEnforcementDocumentationCheckMain"
    args = listOf(repoRootDir)
}
