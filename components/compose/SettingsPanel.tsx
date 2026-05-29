"use client";

// SettingsPanel — the 設定 tool. Signed in: the owner's settings via the same
// OwnerSettingsForm the corner popover uses (no drift). Signed out: it doesn't
// lock the door — it explains and offers the inline sign-in (deferred auth).
// Copy is dictionary-sourced so the toggle localizes it.

import { signOut, type MeResponse } from "@/lib/auth-client.ts";
import { OwnerSettingsForm } from "@/components/owner/OwnerSettingsForm.tsx";
import { useT } from "@/lib/i18n/context.tsx";

async function doSignOut() {
  await signOut();
  window.location.href = "/";
}

export function SettingsPanel({
  me,
  onRequireSignIn,
}: {
  me: MeResponse | null;
  onRequireSignIn: () => void;
}) {
  const t = useT();
  const signedIn = !!me?.signed_in;

  return (
    <section className="settings-panel">
      <h1 className="settings-h">{t("settings.heading")}</h1>

      {signedIn ? (
        <>
          <p className="settings-intro">{t("settings.introSignedIn")}</p>
          <OwnerSettingsForm
            initialDisplayName={me!.display_name ?? ""}
            initialCategory={me!.default_category ?? ""}
          />
          <p className="settings-foot">
            {t("settings.signedInAs", { handle: me!.handle ?? "" })}
          </p>
          <div className="owner-actions">
            <button type="button" className="auth-signout" onClick={doSignOut}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="settings-intro">{t("settings.introSignedOut")}</p>
          <button type="button" className="auth-btn" onClick={onRequireSignIn}>
            {t("settings.signinCta")}
          </button>
        </>
      )}
    </section>
  );
}
