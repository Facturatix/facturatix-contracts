# generate-manifest

Regenerates `schemas/fixtures/manifest.json` — the expected verdict and canonical hash of every
fixture in the corpus.

```bash
dotnet run --project tools/generate-manifest -- schemas/fixtures
```

The manifest is generated, never hand-written. A hash typed by hand cannot be wrong in a way that
fails: it would simply be the value every stack is asked to reproduce, and the mistake would look
like agreement. Deriving it from `RecipeCanonicalJson` means the number in the file is the number
the reference implementation actually produces, and the TypeScript twin has to match it
independently.

Regenerate whenever a fixture changes, then commit the fixture and the manifest together — CI in
facturatix-api, facturatix-generator and facturatix-modeler all assert against it, so a stale
manifest breaks three pipelines at once. That is the intended behaviour.
