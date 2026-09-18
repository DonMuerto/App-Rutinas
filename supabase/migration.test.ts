// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./migrations/20260913170000_create_private_data.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("private data migration invariants", () => {
  it("enables RLS and defines operation-specific policies", () => {
    expect(migration).toMatch(
      /alter table public\.routines enable row level security/i,
    );
    expect(migration).toMatch(
      /alter table public\.block_completions enable row level security/i,
    );

    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(migration).toMatch(
        new RegExp(`create policy routines_${operation}_own`, "i"),
      );
      expect(migration).toMatch(
        new RegExp(`create policy block_completions_${operation}_own`, "i"),
      );
    }
  });

  it("keeps privileged functions as security invoker and denies anon", () => {
    expect(migration).not.toMatch(/security\s+definer/i);
    expect(migration).toMatch(/security\s+invoker/gi);
    expect(migration).toMatch(
      /revoke all on table public\.routines from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.reorder_routines\(uuid\[\]\) from public, anon/i,
    );
  });

  it("protects server-generated audit columns from client writes", () => {
    expect(migration).not.toMatch(/grant insert \([^)]*created_at/i);
    expect(migration).not.toMatch(/grant update \([^)]*updated_at/i);
    expect(migration).not.toMatch(/grant insert \([^)]*completed_at/i);
    expect(migration).not.toMatch(/grant update \([^)]*completed_at/i);
  });
});
