// Contact Kit v1 — boundary metadata (own module; A1/A2/B/B+1 byte-untouched).
//
// ★ C1 (supersedes draft §0/§7): there is NO `pxHoldsNoLink` claim. A1/A2 already
// retain and display an owner-provided public externalActionUrl as board material,
// and that stays — so claiming PX "holds no link" would be an over-claim that
// contradicts the existing line. What PX genuinely does NOT do: hold contact or
// message BODY, relay, generate a contact link of its own, or recommend people.
// The owner controls the external destination.

export interface ContactBoundary {
  pxHoldsNoContactBody: true;
  pxHoldsNoMessageBody: true;
  pxDoesNotRelay: true;
  pxDoesNotGenerateContactLink: true;
  pxDoesNotRecommendPeople: true;
  ownerControlsExternalDestination: true;
}

export const CONTACT_BOUNDARY: ContactBoundary = Object.freeze({
  pxHoldsNoContactBody: true,
  pxHoldsNoMessageBody: true,
  pxDoesNotRelay: true,
  pxDoesNotGenerateContactLink: true,
  pxDoesNotRecommendPeople: true,
  ownerControlsExternalDestination: true,
});
