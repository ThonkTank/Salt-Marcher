import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildChannelSchema,
  buildInfoSchema
} from '../src/shared/contracts/build-info.js'
import { readBuildToolchain, readWorkspaceIdentity } from './build-identity.js'
import { verifyBuildReceipt } from './build-receipt.js'

const workspaceRoot = process.cwd()
const requestedChannelIndex = process.argv.indexOf('--channel')
const requestedChannel =
  requestedChannelIndex === -1
    ? undefined
    : buildChannelSchema.parse(process.argv[requestedChannelIndex + 1])
const build = buildInfoSchema.parse(
  JSON.parse(
    readFileSync(resolve(workspaceRoot, 'out', 'build-info.json'), 'utf8')
  )
)
const receipt = verifyBuildReceipt(resolve(workspaceRoot, 'out'))
if (JSON.stringify(receipt.build) !== JSON.stringify(build))
  throw new Error('Build receipt identity does not match build-info.json')
const workspace = readWorkspaceIdentity(workspaceRoot)
if (
  build.workspaceFingerprint !== workspace.workspaceFingerprint ||
  build.appBuildInputFingerprint !== workspace.appBuildInputFingerprint ||
  build.commit !== workspace.commit ||
  build.dirty !== workspace.dirty
)
  throw new Error(
    'The built output does not match the current workspace; run pnpm check first'
  )
const toolchain = readBuildToolchain(workspaceRoot)
if (JSON.stringify(build.toolchain) !== JSON.stringify(toolchain))
  throw new Error(
    'The built output toolchain does not match the current packaging toolchain'
  )
if (requestedChannel !== undefined && build.channel !== requestedChannel)
  throw new Error(
    `Expected a ${requestedChannel} build, but out contains ${build.channel}`
  )
console.info(
  JSON.stringify({
    component: 'build-identity',
    event: 'workspace-match',
    channel: build.channel,
    workspaceFingerprint: build.workspaceFingerprint,
    appBuildInputFingerprint: build.appBuildInputFingerprint,
    outputHash: receipt.outputHash
  })
)
