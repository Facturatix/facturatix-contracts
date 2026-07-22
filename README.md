# Facturatix.Contracts

Shared contract constants for the Facturatix platform. This package defines the canonical string values used for database serialization across services.

## What's included

| Namespace | Class | Description |
|-----------|-------|-------------|
| `Facturatix.Contracts.Recipes` | `RecipeVersionStatusValues` | Recipe version lifecycle: Draft → Published → Deprecated → Archived |
| `Facturatix.Contracts.Tickets` | `UserStatusValues` | User-facing ticket statuses: Pending, Processing, Completed, Failed |
| `Facturatix.Contracts.Tickets` | `InternalStatusValues` | Internal pipeline statuses (14 states) |

## Installation

```bash
dotnet add package Facturatix.Contracts --source "https://nuget.pkg.github.com/Facturatix/index.json"
```

## Usage

```csharp
using Facturatix.Contracts.Tickets;
using Facturatix.Contracts.Recipes;

// Check ticket status
if (ticket.InternalStatus == InternalStatusValues.Invoiced)
{
    // ...
}

// Filter published recipes
var published = recipes.Where(r => r.Status == RecipeVersionStatusValues.Published);
```

## Consumers

- **facturatix-api** — REST API backend
- **facturatix-generator** — AI-powered invoice generation worker

## Versioning

This package follows [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.x): New constants added (backward compatible)
- **MINOR** (1.x.0): New classes/namespaces added
- **MAJOR** (x.0.0): Breaking changes (renaming/removing constants)

## Development

```bash
# Build
dotnet build src/Facturatix.Contracts/Facturatix.Contracts.csproj

# Pack locally
dotnet pack src/Facturatix.Contracts/Facturatix.Contracts.csproj -c Release -o ./nupkg
```
