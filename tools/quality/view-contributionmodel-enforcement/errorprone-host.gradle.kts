import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../view-contributionmodel-enforcement/errorprone/src/main/java")
    resources.setSrcDirs(emptyList<String>())
}
