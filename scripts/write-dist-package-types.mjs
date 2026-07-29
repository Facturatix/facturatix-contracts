/**
 * Stamps the module type onto each build output.
 *
 * Node decides whether a `.js` file is CommonJS or ESM from the nearest `package.json`'s `type`
 * field. Without these markers both builds would inherit the root package's default and the ESM
 * output would be loaded as CommonJS, failing on its first `export` statement.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

writeFileSync(join(dist, 'cjs', 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n')
writeFileSync(join(dist, 'esm', 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n')
