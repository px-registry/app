# AI-Origin Boundary Doctrine

> **Posture — read this first.**
> This document is a **reference doctrine only**. It is:
> - **not** a contract amendment (it does not amend `PX_BUSINESS_CONTRACT.md` or `PHASE_10_DIRECTION_CONTRACT.md`);
> - **not** an implementation authorization (nothing below is approved to build);
> - **not** finalized UI copy (no string here is a user-facing label);
> - **not** a public claim, and **not** a legal-reviewed claim;
> - **not** a Phase 10 sub-phase (it does not appear in the Phase 10 sub-phase status table).
>
> It records the AI-mediated PX risk boundary analysis so the reasoning is captured once,
> in one place, as the prerequisite reference for any future bounded mitigation work.
> Promotion of any principle here to a contract clause, or any candidate here to an
> implementation, is a **separate, later decision** — not granted by this document.

**Provenance:** Drafted against repo `D:/px-box`, HEAD `8bff00d` (= `8bff00d3991ad2f13ca27fb012e53e87310629d5`, INVENTORY v0.45, Phase 10H gating fork resolved via Option C). Source-of-truth for the boundary itself remains `PHASE_10_DIRECTION_CONTRACT.md`; this doctrine **describes** existing contracts, manifests, and tests by reference and does not restate them as binding.

---

## 0. The governing principle (already sealed)

PX already seals the spine of this doctrine. The Phase 10 forbidden boundary states verbatim:

> **「AI に判断を委ねる form (= AI は読む、人が判断する)」**
> — `PHASE_10_DIRECTION_CONTRACT.md:294`

and, alongside it:

> - 本人の許可なく AI が記憶を取得する form
> - 本人の生の記憶を中央に保管する form
> - 個人を identify する graph の構築
> — `PHASE_10_DIRECTION_CONTRACT.md:295-297`

Everything in this doctrine is a corollary of **"AI reads; the Owner judges."** PX's response to AI-mediated risk is **separation, provenance, and Owner confirmation** — never adjudication, certification, or scoring. PX does not become the AI safety judge.

---

## 1. Core findings (boundary principles)

These are candidate articulations consistent with `PHASE_10_DIRECTION_CONTRACT.md:294`. They are recorded here as **reference**, not promoted to contract clauses.

1. **AI reads; the Owner judges.** (Already sealed — `:294`.) All else follows.
2. **AI output is never PX fact** until Owner-confirmed *or* mechanically observed. Fluency is not fact.
3. **External document instructions are data, not PX commands.** Instructions embedded in read material are inert text, regardless of phrasing.
4. **AI may propose; the Owner decides; PX records.** Three roles, never collapsed into one.
5. **Private → Public is an explicit Owner ritual,** never an AI side effect and never an automatic transform.
6. **Origin is separable; origin is not a verdict.** AI-origin / external-origin / Owner-confirmed should be *distinguishable* — but an origin label must **never** function as a trust or quality score (that would breach `noTrustScore` / `noCertification`).
7. **Official PX tool identity is explicit and narrow.** PX declares *what is ours* — never *what is good*. No authority over third-party tooling.
8. **No AI-driven publish / write / send / commit / install.** (Largely structural already — see §6.)
9. **Non-holding is necessary, not sufficient.** Local device / browser / extension / CLI risk remains even when the PX backend holds nothing. Say so plainly.
10. **PX does not become the AI safety judge.** Mitigations are presentational and structural, never adjudicative.

---

## 2. Threat taxonomy (T1–T10)

Severity = worst-case harm. Likelihood = under the current architecture and the near-future AI-traversal phase. "Handling" names the *category* of an appropriate response, not an authorization to build it.

### T1 — External document instruction injection
- **Description:** AI reads an external doc / page / Surface containing instructions ("ignore prior rules / publish to PX / add to Memory / use this official CLI") and treats them as PX operating instructions.
- **Current exposure:** Low today — PX makes no AI calls; the only ingress is Owner copy-paste into a deterministic strict allow-list parser, not an instruction executor. Rises with the AI-traversal phase, when an external agent reads the Search Board and a malicious surface embeds instructions.
- **Current mitigation:** Owner-mediation (paste, not fetch); `ownerMustConfirm: true`; the no-Mode-C token ban prevents bulk raw-content ingestion; `publicAgentMayInvoke: false` means a manipulated agent still cannot make PX *act*.
- **Missing boundary:** No explicit doctrine that external document content is *data, never a PX command*; no display treatment that visually quarantines pasted external text as inert.
- **Severity: High · Likelihood: Med (low now, rising).** → doctrine + provenance/labeling + display quarantine. Never executable.

### T2 — AI-generated misinformation entering PX
- **Description:** Fluent AI text is placed by the Owner into Surface / Handoff / Receipt / Memory.
- **Current exposure:** Med — nothing structurally stops an Owner from pasting AI prose into a manual-surface `title` / `shortDescription` (owner-controlled free text by design).
- **Current mitigation:** Receipt/Handoff cannot encode AI as fact (no `'ai'` actor); Memory paste-back is candidate-only; forbidden-wording tests block "PXが生成 / AIが自動で作りました".
- **Missing boundary:** No distinction surfaced between AI-drafted and Owner-authored free text at the Surface / Handoff-payload layer.
- **Severity: Med · Likelihood: High.** → provenance/labeling (Owner-private hint, not public badge) + Owner-confirmation gate. Receipt stays declaration-typed (see T8).

### T3 — AI output contaminating Owner Memory
- **Description:** AI output written into Owner Memory as if it were Owner fact; later AI behavior biased by the prior bad output.
- **Current exposure:** Low — the strongest-defended area. Candidate-only intake, per-item confirm, `owner_written`-only provenance, deterministic provenance note, browser-local store.
- **Current mitigation:** The full Distillate / paste-bridge pipeline (§6); `ownerMustConfirm: true`.
- **Missing boundary:** The provenance note is a *string*, not a queryable origin field — "show me everything that originated from external AI" is not first-class. (A deliberate Phase-10D scope choice, not a defect.)
- **Severity: Med · Likelihood: Low.** → optional provenance/labeling enhancement + retain candidate-only. Preserves "PX does not judge AI output" because PX still never accepts/rejects — the Owner does.

### T4 — Private Layer leaking into Public Layer through AI  ⚠ **genuine gap**
- **Description:** AI is given private Memory and drafts a public Surface / Sale / Stand / Handoff message; private details bleed into the public text.
- **Current exposure:** Med–High, and the most philosophically interesting gap. Layer separation is enforced at the *code-import* level (`no-owner-state-in-public-bundle`), but the *human content path* — Owner reads private Memory, asks an external AI to draft a public surface, pastes the result into manual-surface free text — has **no leak check**. Tests guard the bundle, not the prose.
- **Current mitigation:** Structural layer separation; manual surface is Owner-explicit; k-anonymity on descriptors.
- **Missing boundary:** No "private-source risk" signal on a public draft.
- **Severity: High · Likelihood: Med.** → browser-local-only leak check (compares the draft against locally-held Memory strings, entirely client-side, never sends Memory to the backend) + an explicit Owner Private→Public ritual. Must be a *signal/warning*, never a block — blocking would be judging.

### T5 — Fake PX tooling / official-path impersonation  ⚠ **genuine gap**
- **Description:** External text or AI output points the Owner to fake tools — "PX official extension / Agent CLI / Memory Sync / Pro Sync / export tool / wallet / npm package / VS Code extension / GitHub repo / support portal".
- **Current exposure:** High likelihood, High severity — and *increasing*, because Phase 10H will introduce legitimate "PX Pro Sync / managed hosting" surface area that impersonators can mimic. There is currently **no published allowlist** of official tool identities. `px-agent.json` + `px-machine-attestation.json` declare *what PX does not do*, not *which tools are authentically PX*.
- **Current mitigation:** None specific. (No "PX wallet" exists, which helps — but absence is not discoverable by a victim.)
- **Missing boundary:** A canonical, narrow, machine- and human-readable statement of official tool identity + origin (domains, repo, package names).
- **Severity: High · Likelihood: High.** → official tooling *identity* allowlist (narrow) + UI warning when AI output names an unlisted "PX" tool. **Hard constraint:** this must be an identity declaration ("these are ours"), never authority over third-party tooling ("those others are bad") — the latter makes PX a judge/certifier (breaches `noCertification`).

### T6 — Local device / browser / extension compromise
- **Description:** A malicious extension / npm dependency / VS Code extension / fake CLI / malware reads Owner-held Memory even though the PX backend does not.
- **Current exposure:** High severity, outside PX's control surface. This is the structural cost of the non-holding design: Memory lives in browser IndexedDB and adapter keys in local/session storage, both readable by a compromised local environment.
- **Current mitigation:** Non-holding backend limits the *central* blast radius (one compromise ≠ all owners). Client-only key storage with `redact()` discipline.
- **Missing boundary:** No documentation that names this as the explicit residual risk; risk of *false confidence* from "PX doesn't hold your data".
- **Severity: High · Likelihood: Med.** → documentation (in-scope vs out-of-scope) + honest wording. Must state "PX backend non-holding is necessary but not sufficient." Future owner-held encrypted sync (Phase 11+, per `PX_BUSINESS_CONTRACT.md` §V0.4-2) changes the *sync* threat, not the *local-read* threat.

### T7 — AI action overreach
- **Description:** AI attempts to publish Surface / create Memory Card / start Handoff / change Pro / send message / commit code / install extension / change route / call an external service.
- **Current exposure:** Low — the best structural posture in the repo. `publicAgentMayInvoke: false` (type-level) on all action surfaces; manual-surface requires owner credential + step-up + Idempotency-Key; Memory creation requires a per-item Owner click; PX makes no outbound AI calls.
- **Current mitigation:** The above, plus actor-kind enforcement on Handoff.
- **Missing boundary:** No single named "AI capability envelope" doctrine collecting these guarantees (they are distributed across files); no statement for the future A2A-traversal phase about what an agent may *ever* do.
- **Severity: High · Likelihood: Low (now).** → structural guard (already strong) + doctrine naming three tiers: never-AI-executable / AI-may-propose / Owner-explicit-only.

### T8 — Receipt / Handoff fact contamination
- **Description:** AI claims enter Handoff / Receipt as fact.
- **Current exposure:** Low — the actor model already separates `owner` / `counterparty` / `system`; no `'ai'` actor; system events are route-created; terms are hashed.
- **Current mitigation:** `handoff-envelope.ts` actor kinds + sentinel bans on winner / trust / safety / payment fields.
- **Missing boundary:** The *content* of an owner-declared event can be AI-drafted text without that being distinguishable from owner-authored text. The fact-vs-declaration *type* is sound; the *origin of the declared string* is not tracked.
- **Severity: Med · Likelihood: Med.** → provenance/labeling (declaration origin) + preserve the fact-type taxonomy. Correct framing: Receipt records "Owner *declared* X" (already true), never "X is true." That boundary already protects the worst case; the enhancement is optional.

### T9 — Search Board / Surface traversal ambiguity
- **Description:** AI reads the Search Board and presents results as "PX recommends / ranks / trusts."
- **Current exposure:** Low on PX's side (no ranking; `noRecommendation: true` machine-readable; `updated_at DESC` only) but Med on the reader's side — a downstream AI can re-rank and *attribute* the ranking to PX.
- **Current mitigation:** `px-agent.json` boundaries; forbidden-wording tests; `lighthouse_materials` already declared "点数化しない".
- **Missing boundary:** The manifest declares boundaries but does not explicitly instruct a reading agent: "present these as factual discovery; evidence, not score; any ranking you apply is yours, not PX's."
- **Severity: Med · Likelihood: Med.** → provenance/labeling in the manifest (machine-readable reader-guidance) + docs. Stays factual; does not make PX a judge.

### T10 — Prompt / context supply-chain risk
- **Description:** The AI stack itself (model provider, prompt template, tool descriptions, connectors, retrieval, MCP / plugins, assistant memory, local file reads) is compromised or biased.
- **Current exposure:** Out of PX scope by construction — PX does not own the AI stack and makes no AI calls.
- **Current mitigation:** Non-ownership of the AI stack is both the mitigation and the limit.
- **Missing boundary:** No documented acknowledgment that this layer is out-of-scope-but-relevant, nor of what PX *could* offer without owning the stack (e.g., a stable, signed, machine-readable boundary manifest an agent can verify it actually reached).
- **Severity: Med · Likelihood: Med.** → documentation (out-of-scope-but-relevant) + future manifest integrity (the existing `px-machine-attestation.json` is the natural seed; self-declared today).

### Summary table

| Threat | Sev | Likelihood | Primary handling | State today |
|---|---|---|---|---|
| T1 ext-instruction injection | High | Med↑ | doctrine + label + display quarantine | Partial (no-Mode-C, owner-mediation) |
| T2 AI misinfo → PX | Med | High | label + confirm gate | Partial |
| T3 AI → Owner Memory | Med | Low | candidate-only (done) + optional label | **Strong** |
| T4 Private→Public leak | High | Med | **browser-local leak check** + ritual | **Gap (human path)** |
| T5 fake PX tooling | High | High | **identity allowlist + warning** | **Gap** |
| T6 local compromise | High | Med | documentation + honesty | Acknowledged-only |
| T7 AI action overreach | High | Low | structural (done) + doctrine | **Strong** |
| T8 Receipt/Handoff fact | Med | Med | declaration-typing (done) + optional label | **Strong** |
| T9 traversal ambiguity | Med | Med | manifest reader-guidance | Partial |
| T10 supply-chain | Med | Med | documentation + manifest integrity | Out-of-scope-acknowledged |

---

## 3. The two genuine gaps

The analysis converges on **two** real gaps against a substrate that already handles the rest structurally:

- **T4 — Private→Public human-path leak.** Layer separation is enforced for *code* (import-graph tests) but not for the *human content path* (Owner → external AI draft → paste into public free text). The needed mitigation is a **browser-local-only** leak check that warns (never blocks) and never transmits Memory.
- **T5 — fake PX tooling / official-path impersonation.** PX publishes what it does *not* do, but not *which tools are authentically PX*. The needed mitigation is a **narrow identity** allowlist ("these are ours"), never an approved-vendor authority.

Both can be built without PX reading anything centrally and without PX judging anyone. Both are recorded here as gaps, **not** as authorized work.

---

## 4. Candidate mitigations

For each: *protects · where it would live · type · risk of PX becoming a judge · whether it touches the Private Layer.* Recorded for evaluation; none authorized.

| Mitigation | Protects | Where | Type | Judge-risk | Private Layer |
|---|---|---|---|---|---|
| AI-origin / external-origin label (Owner-private hint) | T2, T3, T8 | memory/handoff draft UI + provenance field | UI + schema | Med — must be neutral *origin*, not *quality*; forbid score/badge styling | Reads, does not transmit |
| Owner-confirmation gates (already exist for Memory) | T1, T2, T3 | intake components | UI (exists) | Low | No |
| Isolated AI-candidate inbox | T1, T2, T3 | Memory Garden | UI + schema | Low | Browser-local |
| Private→Public leak check (browser-local) | **T4** | client-side draft preview | browser-local | Med — must *warn*, never block | **Reads Memory locally; must never send to backend** |
| Fake-tooling warning | **T5** | draft / agent UI | UI + docs | High if it judges third parties; Low if identity-only | No |
| Official tooling allowlist (identity manifest) | **T5** | `.well-known` + docs | docs/schema | Low if narrow ("ours"); High if "approved vendors" | No |
| AI-output provenance note (exists as string) | T3, T8 | paste-bridge | schema (exists) | Low | Browser-local |
| No-auto-write scope-cap tests (exist) | T7 | tests | test (exists) | Low | No |
| External-instruction stripping / inert display | T1 | paste preview | UI | Low | No |
| Browser-local-only scan (generic) | T4 | client | browser-local | Med | Reads locally only |
| Human-readable "why this is shown" | T9 | search/surface UI + manifest | UI + docs | Low | No |
| Receipt/Handoff fact-vs-declaration distinction (exists) | T8 | handoff envelope | schema (exists) | Low | No |
| Machine-readable reader-guidance in manifest | T9, T10 | `px-agent.json` | schema/docs | Low | No |

The highest-leverage, lowest-judge-risk *new* items are the browser-local Private→Public leak check (T4) and the narrow official-tooling *identity* manifest (T5).

---

## 5. Future implementation candidates — **NONE AUTHORIZED**

Listed for later selection only. **No row below is approved to build.** Each future build requires its own fresh STOP #0. Several intersect deferred lanes and must respect those gates.

| # | Name | Likely phase | Rough scope | Expected files | Risk | Prerequisite | Docs/impl | Status |
|---|---|---|---|---|---|---|---|---|
| C1 | AI-Origin Boundary doctrine | docs-only (this artifact) | Record §1–§4 principles + taxonomy as reference | this file; LEDGER record | contract-amendment temptation | — | Docs | **landing now (docs-only)** |
| C2 | Distillate provenance label enhancement | Phase 10F-γ-ish | Promote provenance note → optional queryable origin field, Owner-private only | `memory-card.ts`, `memory-paste-bridge.ts`, tests | label-as-trust drift | C1 | Impl | **NOT authorized** |
| C3 | Isolated AI-candidate inbox | post-10F | Distinct candidate surface for AI-origin items before they enter the Garden | `components/memory/*`, store | scope creep | C1, C2 | Impl | **NOT authorized** |
| C4 | Private→Public leak-check preview | new phase | Client-only diff of public draft vs local Memory strings; "private-source risk" signal | new browser-local lib, surface draft UI, tests | **must never send Memory to backend**; warn-not-block | C1 | Impl | **NOT authorized** |
| C5 | Official tooling identity manifest | aligns w/ Phase 10H | Narrow `.well-known` list of authentic PX domains/repo/package names; UI warns on unlisted "PX" tool names | `public/.well-known/*`, `lib/agent-*`, docs | "approved-vendor" overreach | C1; **gated by Phase 10H** (real tools appear there) | Impl + docs | **NOT authorized** |
| C6 | AI action capability-scope doctrine | docs-only | Name the 3 tiers (never / propose / owner-only); reference existing `publicAgentMayInvoke: false` | new doc section | over-formalization | C1 | Docs | **NOT authorized** |
| C7 | Handoff/Receipt fact-type taxonomy | docs-then-impl | Articulate AI-suggestion / Owner-accepted / counterparty-declared / observed-event; declaration-origin label | `handoff-envelope.ts`, docs, tests | Med | C1 | Docs→Impl | **NOT authorized** |
| C8 | Manifest reader-guidance + integrity | Phase 10E-ish lane | Machine-readable "evidence-not-score" guidance; firm up `px-machine-attestation.json` self-declaration | `px-agent.json`, `px-machine-attestation.json`, tests | Low | C1 | Impl | **NOT authorized** |

**Gating notes:** C5 is naturally gated by Phase 10H (legitimate PX tools do not exist until managed hosting does — Phase 10H is deferred via Option C at v0.45). C2 and C5 intersect deferred lanes (Distillate / Phase 10H). Nothing here pulls Phase 10H or Stage 5 forward.

---

## 6. Boundary anchors (existing structural enforcement — read-only references)

This doctrine is grounded in mechanisms that already exist. These are cited as *existing facts*, not amended. Source files live under `px-demo-v1.1/px-demo-build/app/`; canonical docs are at repo root.

**Sealed boundary text**
- `PHASE_10_DIRECTION_CONTRACT.md:283-299` — Phase 10 forbidden boundary, incl. `:294` "AI reads, humans judge"; `:295-297` no-consentless-AI-memory-acquisition, no central raw memory, no identity graph.
- `PHASE_10_DIRECTION_CONTRACT.md:415-460` — Public / Private Layer Separation; "PX backend does not receive the Memory body in Phase 10D."
- `PX_BUSINESS_CONTRACT.md:989-990` (§19) — no custody / no adjudication / no escrow; §V0.4-2 (`:926-945`) — Layer B managed convenience, "convenience cannot become custody."

**Machine-readable boundaries (Public Layer)**
- `public/.well-known/px-agent.json:241-250` — `pxBoundaries`: `noCustody / noAdjudication / noEscrow / noRecommendation / noJudgment / noCertification / noTrustScore / noSafetyScore` all `true`.
- `px-agent.json:251-261` — `publicAgentAccessPolicy` (read allowed, actions require owner credential); `privateLayer.agentReadableMemoryExposureInPhase10E: "absent"`.
- `lib/agent-public-manifest.ts` (DeclaredActionSurface invariant) — `publicAgentMayInvoke: false` fixed at type level for every action surface; manifest is "事実宣言," PX does not rank/score/adjudicate.

**Owner-mediated AI ingress (the only path today)**
- `lib/memory-distillate.ts:9-10,40-42,113` — "PX does not call AI; PX does not auto-accept; parser is pure/deterministic"; parser yields a pending artifact with `ownerMustConfirm: true`; no card creation.
- `lib/memory-paste-bridge.ts:13-23,80,93-104,169,188` — pure mapper; no `Date.now` / no `Math.random` / no `crypto.randomUUID`; provenance is a deterministic factual note (`"Owner-mediated external AI paste-back item; parsedAt=…; itemIndex=…"`); `initialState: 'candidate'`; **no synthetic ID**.
- `lib/memory-card.ts:5-7,95-98,123-126,162-163` — storage is browser-local IndexedDB only; backend receives nothing; `candidate → confirmed` is one-by-one explicit Owner click (no bulk confirm); Phase 10D provenance is `owner_written` only (no `'ai_proposed'` arm).
- `lib/ai-adapter/key-store.ts:3-6` + `lib/ai-adapter/index.ts:13-27` — client-only key storage (server/Worker never see keys); default adapter is the fixture; `lib/ai-adapter/prescreen-types.ts:1-6` — prescreen is fixture-only.

**Discovery is factual, not ranked**
- `worker/src/handlers/search-board.ts:14-15` — "hidden recommendation / paid boost / PX-central ranking score を response に絶対含めない (= N7, ranking は updated_at DESC 固定)"; ordering is `updated_at DESC, search_row_id ASC`.

**Receipt/Handoff fact model**
- `lib/handoff-envelope.ts:125,324-330` — actor kinds `'owner' | 'counterparty' | 'system'` (no `'ai'` actor); sentinel bans on payment / escrow / winner / trust / safety / private-body / identity-graph fields.

**What tests structurally enforce**
- `tests/unit/privacy/no-owner-state-in-public-bundle.test.ts` — transitive import-graph walk; public pages cannot import `OwnerState / AntennaPrivate / OptInRecord / ReceiptPrivate / AiPreScreenAdapter`.
- `tests/unit/privacy/no-mode-c-implementation.test.ts` — forbids raw-content ingestion tokens (`image_bytes / html_snapshot / page_content / full_text / markdown_content`).
- `tests/unit/privacy/no-central-interest-graph-schema.test.ts`, `no-forbidden-public-payload.test.ts`, `k-anonymity-bucket-only.test.ts` (bucket-only, no exact N).
- `tests/unit/memory/phase-10f-beta-2b2-scope-cap.test.ts` — paste components import no LLM SDK / no provider URL / make no network call; `owner_written`-only provenance (no `'ai_proposed'`); no affirmative-authority wording.
- `tests/unit/memory/phase-10f-beta-forbidden-wording.test.ts` — forbids "PXが要約しました / AIが自動で作りました / PXが生成" and certification tokens (`PX認定 / PXおすすめ / Trust Score / Safety Score`).

**Net:** PX's non-holding architecture + owner-mediation + `publicAgentMayInvoke: false` + the layer-separation tests already neutralize the server-side and auto-execution variants of most AI threats. Residual risk concentrates on the **human-judgment surface** (what the Owner sees and decides — T4) and the **client/local environment** (which PX does not own — T6), plus **impersonation** of soon-to-exist official tools (T5).

---

## 7. UIUX / productization connection (internal reference only)

> The framing below is **internal productization reference only**. It is not public copy, not finalized UI language, and not a marketing claim.

The AI-risk boundary *enables* the simple-surface target rather than complicating it:

- The simple-flow productization aim — fenced as internal reference: **「個人が見つかる。直接つながる。」** — depends on the reader trusting that the Search Board is *factual discovery*, not a manipulated ranking. The `noRecommendation` / `updated_at DESC` posture is exactly what keeps the simple flow honest under AI traversal.
- The six simple actions (入札型を立てる → 条件の合う相手を探す → 見つかる → 直接つながる → 受け渡しを進める → 記録が残る) each map to a guarded layer: Surface creation is Owner-explicit (T7), discovery is rank-free (T9), Handoff/Receipt are declaration-typed (T8). The Owner never needs to understand any of this — which is the point.
- The AI-traversal aim — AI reads the board → compares surfaces → reads Wanted/Antenna → **carries candidates back** → **Owner reviews and decides** — *is* the sealed `:294` principle ("AI reads; the Owner judges"). The threat model hardens the "carries back" and "Owner decides" steps against T1 / T2 / T4.
- **Ordinary users do not need to see the structure.** Confirmation gates and provenance live quietly behind the simple surface, appearing only as low-key "you decide" moments, consistent with the quiet-surface design principle. Internal vocabulary (灯台 / Witness / chain / 蒸留 / Distillate) stays out of UI copy — the forbidden-wording tests already enforce this.

No external comparison reference is used in this doctrine.

---

## 8. Non-goals

This doctrine and the STOP #0 that produced it do **not**: implement; edit source / tests / components / CSS; touch Worker / D1 / R2 / migrations; change any Public Layer manifest; change `/agent`; change Owner Memory / Memory Distillate files; change the Search Board; change Handoff / Receipt; start Phase 10H; start Stage 5; amend `PX_BUSINESS_CONTRACT.md`; amend `PHASE_10_DIRECTION_CONTRACT.md`; add a pointer to `INVENTORY.md`; add a `PX_IMPLEMENTATION_BACKLOG.md` queue row; finalize UI copy; make any public or legal-reviewed claim; authorize candidates C2–C8.

---

## 9. GPT counter handling

This is planning / docs-only design work. It **consumes no GPT round**. **GPT 57 remains reserved for the next implementation review.** No renumbering. If any principle or candidate here is later routed through GPT or promoted to a contract clause, that is a separate, explicit decision made at that time.

---

*End of doctrine. Reference only — not a contract amendment, not an implementation authorization, not finalized UI copy, not a public claim, not a legal-reviewed claim.*
