import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/domain-published-enforcement/build-harness/src/main/java")
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?: projectDir.parentFile.parentFile.parentFile.absolutePath

tasks.register<JavaExec>("domainPublishedTopologyCheck") {
    group = "verification"
    description = "Run only the Domain Published build-harness topology rules."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.domain.published.DomainPublishedTopologyCheckMain"
    args = listOf(repoRootDir)
}

tasks.register<JavaExec>("domainPublishedDocumentationEnforcementCheck") {
    group = "verification"
    description = "Run only the Domain Published enforcement-documentation coverage checks."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Documentation enforcement diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.domain.published.DomainPublishedDocumentationEnforcementCheckMain"
    args = listOf(repoRootDir)
}
