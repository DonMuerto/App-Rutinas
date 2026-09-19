// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const baseMigration = readFileSync(
  new URL(
    "./migrations/20260913170000_create_private_data.sql",
    import.meta.url,
  ),
  "utf8",
);
const revisionMigration = readFileSync(
  new URL(
    "./migrations/20260918120000_add_document_revision.sql",
    import.meta.url,
  ),
  "utf8",
);
const draftCopyMigration = readFileSync(
  new URL(
    "./migrations/20260918130000_create_routine_from_draft.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("private data migration invariants", () => {
  it("enables RLS and defines operation-specific policies", () => {
    expect(baseMigration).toMatch(
      /alter table public\.routines enable row level security/i,
    );
    expect(baseMigration).toMatch(
      /alter table public\.block_completions enable row level security/i,
    );

    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(baseMigration).toMatch(
        new RegExp(`create policy routines_${operation}_own`, "i"),
      );
      expect(baseMigration).toMatch(
        new RegExp(`create policy block_completions_${operation}_own`, "i"),
      );
    }
  });

  it("keeps privileged functions as security invoker and denies anon", () => {
    const allMigrations = `${baseMigration}\n${revisionMigration}\n${draftCopyMigration}`;
    expect(allMigrations).not.toMatch(/security\s+definer/i);
    expect(allMigrations).toMatch(/security\s+invoker/gi);
    expect(baseMigration).toMatch(
      /revoke all on table public\.routines from public, anon, authenticated/i,
    );
    expect(baseMigration).toMatch(
      /revoke all on function public\.reorder_routines\(uuid\[\]\) from public, anon/i,
    );
  });

  it("protects server-generated audit columns from client writes", () => {
    expect(baseMigration).not.toMatch(/grant insert \([^)]*created_at/i);
    expect(baseMigration).not.toMatch(/grant update \([^)]*updated_at/i);
    expect(baseMigration).not.toMatch(/grant insert \([^)]*completed_at/i);
    expect(baseMigration).not.toMatch(/grant update \([^)]*completed_at/i);
  });

  it("migrates legacy arrays to envelope v1 and adds revision", () => {
    expect(revisionMigration).toMatch(
      /jsonb_build_object\(\s*'schemaVersion', 1,\s*'blocks', content\s*\)/i,
    );
    expect(revisionMigration).toMatch(
      /add column revision bigint not null default 0/i,
    );
    expect(revisionMigration).toMatch(/routines_content_envelope_v1/i);
    expect(revisionMigration).toMatch(
      /content - 'schemaVersion' - 'blocks' = '\{\}'::jsonb/i,
    );
  });

  it("enforces compare-and-swap for all document writes", () => {
    expect(revisionMigration).toMatch(
      /create trigger routines_enforce_document_revision/i,
    );
    expect(revisionMigration).toMatch(
      /current_setting\(\s*'ritmo\.expected_document_revision'/i,
    );
    expect(revisionMigration).toMatch(
      /create function public\.save_routine_document/i,
    );
    expect(revisionMigration).toMatch(/and revision = expected_revision/i);
    expect(revisionMigration).toMatch(
      /new\.revision := old\.revision \+ 1/i,
    );
    expect(revisionMigration).toMatch(
      /revoke all on function public\.save_routine_document\(uuid, bigint, jsonb\)\s+from public, anon/i,
    );
  });

  it("creates draft copies atomically and idempotently under RLS", () => {
    expect(draftCopyMigration).toMatch(
      /create table public\.routine_draft_copy_requests/i,
    );
    expect(draftCopyMigration).toMatch(
      /primary key \(user_id, request_id\)/i,
    );
    expect(draftCopyMigration).toMatch(
      /alter table public\.routine_draft_copy_requests enable row level security/i,
    );
    expect(draftCopyMigration).toMatch(
      /create function public\.create_routine_from_draft/i,
    );
    expect(draftCopyMigration).toMatch(/security invoker/i);
    expect(draftCopyMigration).toMatch(
      /where id = source_routine_id\s+and user_id = auth\.uid\(\)/i,
    );
    expect(draftCopyMigration).toMatch(
      /select copy_request\.routine_id[\s\S]*copy_request\.request_id = create_routine_from_draft\.request_id/i,
    );
    expect(
      draftCopyMigration.indexOf("select copy_request.routine_id"),
    ).toBeLessThan(draftCopyMigration.indexOf("if not exists ("));
    expect(
      draftCopyMigration.indexOf("insert into public.routines"),
    ).toBeLessThan(
      draftCopyMigration.indexOf(
        "insert into public.routine_draft_copy_requests",
      ),
    );
    expect(draftCopyMigration).toMatch(
      /document,\s+coalesce\(max\(position\) \+ 1, 0\)/i,
    );
    expect(revisionMigration).toMatch(
      /add column revision bigint not null default 0/i,
    );
    expect(draftCopyMigration).toMatch(
      /revoke all on function public\.create_routine_from_draft\([\s\S]*\) from public, anon, authenticated/i,
    );
  });

  it("does not expose draft-copy idempotency keys through direct table access", () => {
    expect(draftCopyMigration).toMatch(
      /current_setting\('ritmo\.draft_copy_request_id', true\)/i,
    );
    expect(draftCopyMigration).toMatch(
      /revoke all on table public\.routine_draft_copy_requests\s+from public, anon, authenticated/i,
    );
    expect(draftCopyMigration).not.toMatch(
      /grant (?:update|delete).*routine_draft_copy_requests/i,
    );
  });
});
