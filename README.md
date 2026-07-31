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

| Consumer                  | Package                        | Consumes directly                                                                                    | Mirrors, with a test as the gate                                                        |
| ------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **facturatix-api**        | `Facturatix.Contracts` (NuGet) | `RecipeSchemaV2Validator`, `RecipeCanonicalJson`, `ApiErrorCodes`, `TicketRejectionReasonValues`, the fixture corpus | `InternalStatus` / `UserStatus` enums, `ExecutionAttemptOutcome` — `StatusContractTests`   |
| **facturatix-generator**  | `Facturatix.Contracts` (NuGet) | `RecipeSchemaV2Validator`, `RecipeCanonicalJson`, the status constants, the fixture corpus            | `ExecutionAttemptOutcome`, `DeliveryMode` — `StatusContractTests`                          |
| **facturatix-modeler**    | `@facturatix/contracts` (npm)  | schema, validator, canonicalizer, fixtures                                                            | —                                                                                          |
| **facturatix-web-app**    | `@facturatix/contracts` (npm)  | `TICKET_REJECTION_REASON`                                                                             | —                                                                                          |

### Why some vocabularies are mirrored rather than consumed

The API's `InternalStatus` is an enum with behaviour attached, and the Generator's
`ExecutionAttemptOutcome` names a column this package does not own. Turning either into a direct
dependency would mean the three repositories could no longer be released independently: a status
added for one service would have to ship a contract version before the change that needed it could
merge.

The pattern is therefore **own constants plus a mirror test**, and the mirror test is a blocking
gate in every consumer's CI (plan task D7.1). It costs one test per vocabulary; what it buys is that
a drift is a build failure with a name, in the repository that caused it, instead of a value written
to a shared column that the other service silently fails to recognise.

Anything a consumer *branches on* — the schema, the canonical hash, the error codes, the ticket
rejection reasons — is consumed directly, because there a divergence has no safe failure mode.

The rejection reasons are the clearest case. The API stores a code rather than a sentence so the
wording lives in the client and every user who hit the same problem reads the same explanation in
their own language. A code the client does not recognise therefore has no good outcome: it either
shows the user a raw `image_too_blurry`, or silently substitutes a message that is not about their
problem. That is why they ship here, in both halves, rather than being copied into each repository.

### The gate

Each of the three runs the fixture corpus in its own CI, and the two .NET services also run their
mirror tests there. Changing a rule here breaks the pipeline of any consumer that has not adopted it
— which is the entire purpose.

> The Generator used to carry a vendored `src/Contracts/` folder that built a second assembly also
> named `Facturatix.Contracts`. Whichever one won at restore time decided what "the contract" meant,
> and nothing recorded which had. It is gone, and a test asserts the contract types resolve from the
> package.

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

**2.0.3** adds `TicketRejectionReasonValues` (C#) and `TICKET_REJECTION_REASON` (TypeScript): the
closed set of reasons an administrator may assign when rejecting a ticket, which replaced the free
text a reviewer used to type. PATCH because it only adds constants — nothing existing changed, and
a document canonicalized under 2.0.2 hashes identically under 2.0.3. Note that adding a code here
is nonetheless a breaking act for a client: it needs user-facing copy in every locale before an
administrator can select it, which is what the consumers' tests assert.

**2.0.2** is documentation only: the consumer matrix above, and the reasoning behind why some
vocabularies are consumed directly and others mirrored with a test as the gate (plan task D7.1).
No schema, validator, canonicalizer, constant or fixture changed — a document canonicalized under
2.0.1 hashes identically under 2.0.2. It is published rather than left in the repository because
the README ships inside both packages, and the matrix is only useful to whoever is deciding how to
consume the contract.

**2.0.1** makes the TypeScript canonicalizer refuse a value with no JSON representation — a
function or a symbol — instead of serializing it as `null`. `JSON.stringify` omits such a key
entirely, so the old fallback produced a hash the API could never reproduce from the payload it
received, and the publication would have been rejected as corrupted in transit with nothing pointing
at the cause.

**2.0.0** introduces the recipe execution contract v2 and drops the `netstandard2.0` target. Both
consumers are `net10.0`, and targeting the framework directly is what lets the validator and the
canonicalizer use `System.Text.Json` without adding a dependency to a package whose entire purpose
is to be a dependency.
