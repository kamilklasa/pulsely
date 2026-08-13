import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "@/shared/api/seam-b.utils";
import { canUnlinkIdentity, googleIdentityOf, integrationErrorKey } from "./integrations.utils";

// Seam B — real local Supabase (`supabase start`), no mocking. The OAuth round trip
// itself needs a browser and Google's consent screen, so what this seam pins down is
// everything on either side of it: that the project will hand out a link at all, and
// what the server does to an unlink the UI is supposed to have refused first.
describe("google integration (Seam B)", () => {
  it("hands out a link to Google, which means manual linking is on", async () => {
    const client = await signInAsNewUser("integrations-link");

    const { data, error } = await client.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: "http://localhost:5175/board", skipBrowserRedirect: true },
    });

    // With `enable_manual_linking = false` this is a 422 manual_linking_disabled,
    // and Connect fails for every account in the project.
    expect(integrationErrorKey(error)).toBe("generic");
    expect(error).toBeNull();
    expect(data.url).toContain("accounts.google.com");
  });

  it("refuses to unlink the only identity, and says which refusal it is", async () => {
    const client = await signInAsNewUser("integrations-unlink");

    const { data, error } = await client.auth.getUserIdentities();
    expect(error).toBeNull();
    const identities = data!.identities;

    // A magic-link account: one email identity, no Google, nothing to disconnect.
    expect(identities.map((identity) => identity.provider)).toEqual(["email"]);
    expect(googleIdentityOf(identities)).toBeUndefined();
    expect(canUnlinkIdentity(identities)).toBe(false);

    const { error: unlinkError } = await client.auth.unlinkIdentity(identities[0]!);
    expect(unlinkError).not.toBeNull();
    expect(integrationErrorKey(unlinkError)).toBe("lastIdentity");

    // The refusal is the server's too, not just the UI's: the account is intact.
    const { data: after } = await client.auth.getUserIdentities();
    expect(after!.identities).toHaveLength(1);
  });
});
