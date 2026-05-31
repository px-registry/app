// Integration tests for POST /api/owner/board/unpublish. `node --test`.
//
// Proves the takedown's security surface: CSRF/Origin guard, signed session, and
// the ownership check — owner A can never retire owner B's row — plus the happy
// path that flips publication_state to 'retired' on the owner's own row.

import { test } from "node:test";
import assert from "node:assert/strict";

import * as unpublishModule from "./unpublish.ts";
import { onRequestPost } from "./unpublish.ts";
import { createSessionToken, SESSION_COOKIE } from "../../../_auth.ts";

const AUTH_SECRET = "test-secret-OBP";
const ALLOWED_ORIGIN = "https://app.px-registry.org";

function fakeD1(rows: Record<string, { owner_handle: string; publication_state: string }>) {
  const state = { rows: { ...rows } };
  function makeStmt(sql: string) {
    let bound: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) { bound = a; return stmt; },
      async first<T>() {
        if (/SELECT owner_handle FROM board_records/.test(sql)) {
          const r = state.rows[String(bound[0])];
          return (r ? { owner_handle: r.owner_handle } : null) as T;
        }
        return null as T;
      },
      async run() {
        if (/UPDATE board_records SET publication_state = 'retired'/.test(sql)) {
          const id = String(bound[1]); // bind order: (at, recordId)
          if (state.rows[id]) state.rows[id].publication_state = "retired";
        }
        return { success: true };
      },
    };
    return stmt;
  }
  return { _state: state, prepare: (sql: string) => makeStmt(sql) };
}

async function postUnpublish(
  db: ReturnType<typeof fakeD1>,
  body: unknown,
  opts: { handle?: string; origin?: string | null } = {},
) {
  const env = { BOARD: db, AUTH: {}, AUTH_SECRET } as never;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const origin = opts.origin === undefined ? ALLOWED_ORIGIN : opts.origin;
  if (origin) headers["Origin"] = origin;
  if (opts.handle) {
    const token = await createSessionToken({ AUTH_SECRET } as never, opts.handle);
    headers["Cookie"] = `${SESSION_COOKIE}=${token}`;
  }
  const request = new Request("https://app.px-registry.org/api/owner/board/unpublish", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return onRequestPost({ request, env } as never);
}

const seed = () => fakeD1({ "rec_aoi1": { owner_handle: "aoi-bonsai", publication_state: "public" } });

test("OBP-impl-17 (CSRF): a missing Origin is rejected 403", async () => {
  const res = await postUnpublish(seed(), { recordId: "rec_aoi1" }, { handle: "aoi-bonsai", origin: null });
  assert.equal(res.status, 403);
});

test("OBP-impl-18 (auth): no session → 401", async () => {
  const res = await postUnpublish(seed(), { recordId: "rec_aoi1" }, {});
  assert.equal(res.status, 401);
});

test("OBP-impl-19: a missing recordId → 400", async () => {
  const res = await postUnpublish(seed(), {}, { handle: "aoi-bonsai" });
  assert.equal(res.status, 400);
});

test("OBP-impl-20: an unknown recordId → 404", async () => {
  const res = await postUnpublish(seed(), { recordId: "rec_nope" }, { handle: "aoi-bonsai" });
  assert.equal(res.status, 404);
});

test("OBP-impl-21 (ownership): owner B cannot retire owner A's row → 403, row stays public", async () => {
  const db = seed();
  const res = await postUnpublish(db, { recordId: "rec_aoi1" }, { handle: "mallory" });
  assert.equal(res.status, 403);
  assert.equal(db._state.rows["rec_aoi1"].publication_state, "public");
});

test("OBP-impl-22: owner retires their own row → 200, publication_state becomes retired", async () => {
  const db = seed();
  const res = await postUnpublish(db, { recordId: "rec_aoi1" }, { handle: "aoi-bonsai" });
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.ok, true);
  assert.equal(out.publicationState, "retired");
  assert.equal(db._state.rows["rec_aoi1"].publication_state, "retired");
});

test("OBP-impl-23: no GET handler is exported", () => {
  assert.equal(typeof onRequestPost, "function");
  assert.equal((unpublishModule as Record<string, unknown>).onRequestGet, undefined);
});
