import type { Metadata } from "next";
import { Footer } from "../Footer";
import { SignUp } from "./SignUp";

export const metadata: Metadata = {
  title: "Create a passkey — PX Registry",
  description:
    "Claim a handle and create a passkey. PX holds a public key and a handle — no password, no personal information.",
};

// Static shell; the passkey ceremony runs client-side in SignUp.
export default function SignUpPage() {
  return (
    <main className="page">
      <a className="back" href="/">
        ← PX Registry
      </a>
      <SignUp />
      <Footer />
    </main>
  );
}
