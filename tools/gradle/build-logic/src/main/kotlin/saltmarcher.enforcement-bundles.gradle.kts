import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.enforcement.loadEnforcementBundlesExtension

val extension = loadEnforcementBundlesExtension()
extensions.add(EnforcementBundlesExtension::class.java, "saltmarcherEnforcementBundles", extension)
