/**
 * The patched picomatch copy stands in for every registry release, unchanged and for every
 * consumer (GHSA-fc5q-39xc-vjpf).
 *
 * picomatch compiles a repeated extglob over a wildcard (`+(*)`, `+(*a)`) into an unbounded
 * quantifier nested inside another, and no published release fixes it. So `picomatch@4` resolves
 * to `scripts/shims/picomatch`, the published 4.0.7 package with `lib/parse.js` patched.
 * `pnpm audit` only answers whether a known-vulnerable version is installed; it cannot notice when
 * the substitution stops working, and a copy that installs cleanly but compiles globs differently
 * would pass it and change what lint walks. So this script checks that:
 *
 * - no registry release of picomatch is in the lockfile;
 * - the copy is byte for byte the reviewed one — the web app, the admin console, the landing and
 *   the modeler pin the same hash, so a copy edited in one repository fails there;
 * - every consumer reached from the project root resolves to it, and at least one still does;
 * - the advisory's patterns compile without a repetition nested around a wildcard;
 * - every rewrite matches exactly what the unpatched compiler matched.
 *
 * The other repositories assert the same rules in their supply-chain unit test. This one has no
 * unit-test runner, so it runs from `pnpm run verify` and in CI.
 *
 * @see pnpm-workspace.yaml — the override, and when to delete it
 */

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The reviewed copy and the major it serves; the digest is `shimDigest` of the directory. */
const SHIM = {
  major: '4',
  dir: join(root, 'scripts', 'shims', 'picomatch'),
  digest: '145247bdb19a082c612d8ae4fe56ecd457d2de7a3bf8777fa8ccf119e492a95d'
}

/**
 * Patterns whose repetition the patch drops, one per rewrite it makes: a single starred branch,
 * starred branches beside plain ones on either side, and a lone negation.
 */
const REWRITTEN_PATTERNS = [
  '+(*)',
  '*(*a)',
  '+(a*b)',
  '+(*a|b)',
  '*(a*|b)',
  '+(*.a|*.b)',
  '+(!(a))',
  '*(!(a)).b',
  'x/+(*a)'
]

/**
 * Every package the lockfile installs, as its `name@version` key, read from the `packages:`
 * section only. A `link:` dependency never appears there. O(n) in the lockfile's lines.
 */
function lockedPackages() {
  const lines = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8').split('\n')
  const start = lines.indexOf('packages:')
  const end = lines.indexOf('snapshots:')
  const keys = []

  for (const line of lines.slice(start + 1, end === -1 ? undefined : end)) {
    const match = /^ {2}'?([^\s':][^':]*?)'?:\s*$/.exec(line)
    if (match) keys.push(match[1])
  }

  return keys
}

/**
 * sha256 over every file under `dir`, sorted by relative path, hashing `path\0content\0` per file.
 * O(b) in the bytes under the directory.
 */
function shimDigest(dir) {
  const files = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else files.push(relative(dir, path).split(sep).join('/'))
    }
  }
  walk(dir)

  const hash = createHash('sha256')
  for (const file of files.sort()) {
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(join(dir, file)))
      .update('\0')
  }
  return hash.digest('hex')
}

/**
 * Every link to `picomatch` a consumer resolves, with the majors that consumer accepts.
 *
 * In pnpm's virtual store each package sits in its own `node_modules` beside one symlink per
 * dependency, so the package itself is the only real directory there, or under its scope. The walk
 * follows those symlinks from the project root, the way Node resolves them, so a directory an
 * earlier install left behind in the store is never counted. O(p + d) in the reachable packages
 * and their dependency links.
 */
function picomatchLinks() {
  const store = realpathSync(join(root, 'node_modules', '.pnpm'))
  const pending = [join(root, 'node_modules')]
  const visited = new Set(pending)
  const links = []

  while (pending.length > 0) {
    const modules = pending.pop()
    const names = readdirSync(modules)
      .filter((name) => !name.startsWith('.'))
      .flatMap((name) =>
        name.startsWith('@')
          ? readdirSync(join(modules, name)).map((inner) => `${name}/${inner}`)
          : [name]
      )
    const owner = names.find((name) => !lstatSync(join(modules, name)).isSymbolicLink())

    for (const name of names) {
      const path = join(modules, name)
      if (!lstatSync(path).isSymbolicLink() || !existsSync(path)) continue
      const target = realpathSync(path)

      if (name === 'picomatch' && owner !== undefined) {
        const manifest = JSON.parse(readFileSync(join(modules, owner, 'package.json'), 'utf8'))
        const range =
          manifest.dependencies?.picomatch ??
          manifest.optionalDependencies?.picomatch ??
          manifest.peerDependencies?.picomatch
        const accepts = range.split('||').map((part) => /\d+/.exec(part)?.[0] ?? '')
        links.push({ consumer: owner, accepts, target })
      }

      if (!target.startsWith(store + sep)) continue
      const next = name.includes('/') ? dirname(dirname(target)) : dirname(target)
      if (!visited.has(next)) {
        visited.add(next)
        pending.push(next)
      }
    }
  }

  return links
}

/**
 * Every string over `alphabet` of at most `maxLength` characters, the empty one included.
 * O(a^n) for a characters and length n — kept small by the caller.
 */
function allStrings(alphabet, maxLength) {
  const strings = ['']
  let previous = ['']
  for (let length = 1; length <= maxLength; length++) {
    previous = previous.flatMap((prefix) => alphabet.map((char) => prefix + char))
    strings.push(...previous)
  }
  return strings
}

const failures = []

const registryCopies = lockedPackages().filter((key) => key.startsWith('picomatch@'))
if (registryCopies.length > 0) {
  failures.push(`the lockfile installs ${registryCopies.join(', ')} from the registry.`)
}

const digest = shimDigest(SHIM.dir)
if (digest !== SHIM.digest) {
  failures.push(`scripts/shims/picomatch hashes to ${digest}, not the reviewed ${SHIM.digest}.`)
}

const shim = realpathSync(SHIM.dir)
const links = picomatchLinks()
if (links.length === 0) {
  failures.push(
    'no package resolves picomatch any more: the override has outlived its reason — delete it, ' +
      'scripts/shims/picomatch, its ESLint entry, this script and its CI step.'
  )
}
for (const link of links) {
  if (link.target !== shim) failures.push(`${link.consumer} resolves picomatch to ${link.target}.`)
  if (!link.accepts.includes(SHIM.major)) {
    failures.push(`${link.consumer} does not accept picomatch ${SHIM.major}.x.`)
  }
}

// The copy is loaded the way its consumers load it: as CommonJS, by directory.
const picomatch = createRequire(join(SHIM.dir, 'index.js'))(SHIM.dir)

// Unpatched, these are `(?:[^/]*?)+` and `(?:[^/]*?a)+`: a 29-character near miss of the first one
// blocks the event loop for about 30 seconds. The shapes are checked rather than timed, because a
// regression would hang this script instead of failing it.
for (const [pattern, expected] of [
  ['+(*)', '^(?:(?=.)(?:[^/]*?))$'],
  ['+(*a)', '^(?:(?=.)(?:[^/]*?a))$']
]) {
  const source = picomatch.makeRe(pattern).source
  if (source !== expected) failures.push(`${pattern} compiles to ${source}, not ${expected}.`)
}
if (picomatch.isMatch('ab', '+([ab]*)') || !picomatch.isMatch('+([ab]*)', '+([ab]*)')) {
  failures.push('+([ab]*) no longer falls back to the literal safeguard.')
}

// `maxExtglobRecursion: false` turns picomatch's safeguards off, which compiles the nested
// repetition exactly as an unpatched copy does — the reference semantics.
const inputs = allStrings(['a', 'b', '.', '/'], 5)
for (const options of [{}, { dot: true }, { windows: true }]) {
  for (const pattern of REWRITTEN_PATTERNS) {
    const patched = picomatch.makeRe(pattern, options)
    const reference = picomatch.makeRe(pattern, { ...options, maxExtglobRecursion: false })
    const label = `${pattern} with ${JSON.stringify(options)}`

    if (patched.source === reference.source) failures.push(`${label} is no longer rewritten.`)
    const differences = inputs.filter((input) => patched.test(input) !== reference.test(input))
    if (differences.length > 0) {
      failures.push(`${label} disagrees with the unpatched compiler on ${differences.join(', ')}.`)
    }
  }
}

if (failures.length > 0) {
  console.error('The patched picomatch stand-in (GHSA-fc5q-39xc-vjpf) is not what was reviewed:\n')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(
  `picomatch stand-in OK — reviewed bytes, resolved by ${String(links.length)} consumer(s), ` +
    'exact on every rewrite.'
)
