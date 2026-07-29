# Facturatix.Contracts / @facturatix/contracts

The canonical contract of the Facturatix platform, shipped twice from one source: a NuGet package
for the .NET services and an npm package for the Electron modeler. Both carry the same `schemas/`
directory and the same version number, published from the same commit.

## Why two packages

Three codebases have to agree on what a recipe _is_: the Modeler writes one, the API validates and
stores it, the Generator executes it. While that agreement lived only in prose, the three drifted —
the Modeler emitted `static_key` where the Generator read `value`, `timeout_ms` meant a sleep in one
place and a deadline in another, and no notion of "the portal confirmed" existed anywhere, so a run
succeeded by not throwing.

This package makes the agreement executable. The schema is one file, the fixtures are one corpus,
and both implementations of the validator must reproduce the same verdict on it.

## What's included

| Namespace / module                          | Contents                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `schemas/recipe-execution.schema.v2.json`   | The recipe execution contract v2 (JSON Schema 2020-12) plus the semantic rules it cannot express      |
| `schemas/fixtures/`                         | 15 fixtures and a generated manifest with each one's verdict and canonical hash                       |
| `Facturatix.Contracts.Recipes`              | `RecipeSchemaV2`, `RecipeSchemaV2Validator`, `RecipeCanonicalJson`, `RecipeContractResources`         |
| `Facturatix.Contracts.Errors`               | `ApiErrorCodes` — the machine-readable `code` carried by every API `ProblemDetails`                   |
| `Facturatix.Contracts.Tickets` / `.Recipes` | Ticket and recipe-version lifecycle status constants                                                  |
| `@facturatix/contracts`                     | TypeScript mirror of the above, plus `@facturatix/contracts/fixtures` for loading the corpus in tests |

## The recipe execution contract v2

A v2 document declares what to run, how to branch, and — the part v1 had no notion of — how to know
the portal actually finished:

```json
{
  "schema_version": 2,
  "variables": [{ "name": "rfc", "source": "user.fiscal.rfc", "required": true }],
  "actions": [
    { "id": "open", "action": "goto", "url": "https://facturacion.comercio.mx/" },
    {
      "id": "fill-rfc",
      "action": "fill",
      "locator": { "strategy": "role", "role": "textbox", "name": "RFC" },
      "value": "{{rfc}}"
    }
  ],
  "edges": [{ "from": "open", "to": "fill-rfc" }],
  "completion": {
    "mode": "all",
    "assertions": [
      {
        "type": "selector_text",
        "locator": { "strategy": "css", "value": "#resultado" },
        "contains": "solicitud completada"
      }
    ],
    "delivery": { "mode": "portal_email", "destination_binding": "user.fiscal.email" }
  }
}
```

Rules worth knowing before authoring one:

1. **Locators are structured, never Playwright source.** `{ "strategy": "role", "role": "textbox" }`,
   not `getByRole('textbox')`. Parsing code with a regex is how `getByLabel` silently became a CSS
   selector.
2. **`wait.duration_ms` and `timeout_ms` are different fields.** One is a sleep, the other a
   deadline.
3. **`press.key` is the only name for the key.** Not `static_key`, not `value`.
4. **The action allowlist is short on purpose**: `goto, click, fill, select, check, uncheck, press,
wait, wait_selector`. `dialog_accept`, `dialog_dismiss`, `popup`, `custom`, `upload` and
   `dblclick` are rejected — they are no-ops in the Generator, so allowing them would guarantee a
   false success. `download` is excluded permanently: Facturatix does not handle fiscal files.
5. **At least one terminal assertion is mandatory.** Finishing the last step is not evidence that
   the portal did anything.
6. **Unknown means invalid.** An unrecognised condition type, verb or property is a rejection at
   validation time — never a value quietly dropped at execution time.

## Canonical hash

`RecipeCanonicalJson` / `computeHash` implement RFC 8785 plus SHA-256. The Modeler hashes a document
before publishing, the API recomputes it on arrival, and a mismatch rejects the publication. That
only works if both implementations agree byte for byte, which required two explicit choices:

- Strings are escaped exactly as ECMAScript `JSON.stringify` escapes them. .NET escapes non-ASCII as
  `\uXXXX` by default, which would give every accented Spanish string a different hash per stack.
- Numbers are guaranteed equal only for integers — which is why every numeric field in the schema is
  declared `integer`.

## Installation

```bash
# .NET
dotnet add package Facturatix.Contracts --source "https://nuget.pkg.github.com/Facturatix/index.json"

# Node (registry: https://npm.pkg.github.com)
pnpm add @facturatix/contracts
```

## Usage

```csharp
using Facturatix.Contracts.Recipes;

var verdict = RecipeSchemaV2Validator.Validate(stepsJson);
if (!verdict.IsValid)
{
    // verdict.Codes are stable identifiers; verdict.Messages are for humans
    return Result.Failure(RecipeErrors.SchemaInvalid(verdict.Messages));
}

var hash = RecipeCanonicalJson.ComputeHash(stepsJson);
```

```ts
import { validateRecipeDocument, computeHash, API_ERROR_CODES } from '@facturatix/contracts'

const verdict = validateRecipeDocument(stepsJson)
if (!verdict.isValid) showErrors(verdict.messages)

const hash = computeHash(stepsJson)
```

## Consumers

- **facturatix-api** — validates on publish, persists the canonical hash and the schema version
- **facturatix-generator** — refuses to execute anything the validator rejects
- **facturatix-modeler** — authors documents and validates locally before publishing

Each of the three runs the fixture corpus in its own CI. Changing a rule here breaks the pipeline of
any consumer that has not adopted it — which is the entire purpose.

## Development

```bash
# .NET
dotnet build src/Facturatix.Contracts/Facturatix.Contracts.csproj
dotnet pack  src/Facturatix.Contracts/Facturatix.Contracts.csproj -c Release -o ./nupkg

# Node
pnpm install
pnpm run lint        # type-aware ESLint + Prettier
pnpm run typecheck   # both the CommonJS and the ESM targets
pnpm run build
pnpm run verify      # asserts the TypeScript validator reproduces the C#-generated manifest
```

The lint rules are type-aware on purpose. These files are the reference implementation three
services agree on, so an `any` that slips into the validator would make it accept a document the C#
half rejects — and the fixture corpus would not catch it, because both halves would be reading the
same fixture through different amounts of checking.

After changing a fixture, regenerate the manifest and commit both together:

```bash
dotnet run --project tools/generate-manifest -- schemas/fixtures
```

## Versioning

[Semantic Versioning](https://semver.org/), applied to both packages at once:

- **PATCH** — new constants, clarified messages
- **MINOR** — new optional contract fields, new error codes
- **MAJOR** — renaming or removing anything a consumer branches on

**2.0.1** makes the TypeScript canonicalizer refuse a value with no JSON representation — a
function or a symbol — instead of serializing it as `null`. `JSON.stringify` omits such a key
entirely, so the old fallback produced a hash the API could never reproduce from the payload it
received, and the publication would have been rejected as corrupted in transit with nothing pointing
at the cause.

**2.0.0** introduces the recipe execution contract v2 and drops the `netstandard2.0` target. Both
consumers are `net10.0`, and targeting the framework directly is what lets the validator and the
canonicalizer use `System.Text.Json` without adding a dependency to a package whose entire purpose
is to be a dependency.
