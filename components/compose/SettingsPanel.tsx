"use client";

// SettingsPanel — the 設定 tool in the center workspace. When signed in it shows
// the owner's settings via the same OwnerSettingsForm the corner popover uses
// (display name + default category), so the two surfaces can't drift. When
// signed out it doesn't lock the door — it explains what settings are for and
// offers the inline sign-in, keeping with the dashboard's deferred-auth stance.

import type { MeResponse } from "@/lib/auth-client.ts";
import { OwnerSettingsForm } from "@/components/owner/OwnerSettingsForm.tsx";

export function SettingsPanel({
  me,
  onRequireSignIn,
}: {
  me: MeResponse | null;
  onRequireSignIn: () => void;
}) {
  const signedIn = !!me?.signed_in;

  return (
    <section className="settings-panel">
      <p className="settings-eyebrow" lang="ja">
        設定
      </p>
      <h1 className="settings-h">Settings</h1>

      {signedIn ? (
        <>
          <p className="settings-intro">
            Your display name and default category — used to pre-fill the
            composer when you sign in. These are the same settings as the card in
            your owner popover.
          </p>
          <OwnerSettingsForm
            initialDisplayName={me!.display_name ?? ""}
            initialCategory={me!.default_category ?? ""}
          />
          <p className="settings-foot">
            Signed in as <span className="settings-handle">@{me!.handle}</span>.
          </p>
        </>
      ) : (
        <>
          <p className="settings-intro">
            Settings — your display name and default category — belong to your
            identity. Sign in to view and change them. You can keep exploring the
            tools without one.
          </p>
          <button type="button" className="auth-btn" onClick={onRequireSignIn}>
            Sign in to manage settings
          </button>
        </>
      )}
    </section>
  );
}
