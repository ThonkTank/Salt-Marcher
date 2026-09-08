import { z } from 'zod'
import { ProfileMaintenance } from '../src/core/maintenance/profile-maintenance.js'
const [root, version] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(process.argv.slice(2))
const id = await new ProfileMaintenance(root, version).backup()
process.stdout.write(JSON.stringify({ id }))
