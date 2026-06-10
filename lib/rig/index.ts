// R1.5 rig pure core — barrel. Ported from px-table @ main f46f470 (see rig.ts
// header). Pure TS, no I/O: this layer assembles prompts and shapes the public
// pool only. Persistence lives in a separate owner-local module; AI calls live
// in the UI lane (browser-direct, owner's own key) — never here.

export {
  RIG_MEMORY_KINDS,
  RIG_LAW,
  buildPublicPool,
  buildOwnerPrompt,
  type RigMemoryKindV1,
  type RigMemoryItemV1,
  type RigOwnerV1,
  type RigPublicPoolItemV1,
  type BuildPublicPoolOptionsV1,
  type RigLawV1,
} from "./rig.ts";

export {
  parseRigOwners,
  assignOwnerRefs,
  effectiveOwnerRefs,
  pastedOutputEchoesPrivate,
  RIG_PRIVATE_ECHO_NOTE,
  RIG_SAMPLE_JSON,
  type RigIntakeResultV1,
} from "./rig-intake.ts";
