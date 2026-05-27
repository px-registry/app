import type { Metadata } from "next";
import { Footer } from "../Footer";
import { SignIn } from "./SignIn";

export const metadata: Metadata = {
  title: "Sign in — PX Registry",
  description: "Sign in with your passkey.",
};

export default function SignInPage() {
  return (
    <main className="page">
      <a className="back" href="/">
        ← PX Registry
      </a>
      <SignIn />
      <Footer />
    </main>
  );
}
