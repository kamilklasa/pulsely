import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import type { AssuranceLevels, TotpEnrolment } from "./two-factor.types";

export const twoFactorKeys = {
  factors: ["mfa", "factors"] as const,
};

export function useTwoFactorFactors() {
  return useQuery({
    queryKey: twoFactorKeys.factors,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.all;
    },
  });
}

// Deliberately not a query. `getAuthenticatorAssuranceLevel` decodes the JWT the
// client already holds — no network call — so there is nothing to save by caching
// it, and plenty to lose: a cached "aal2" is a 2FA bypass the moment it outlives
// the session that earned it. The guards ask fresh on every navigation.
export async function readAssuranceLevel(): Promise<AssuranceLevels> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
}

// Hands back the QR code and the secret for the *unverified* factor this creates.
// Nothing is protecting the account yet — `useVerifyTotp` is what makes it real.
export function useEnrolTotp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendlyName: string): Promise<TotpEnrolment> => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
      if (error) throw error;
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twoFactorKeys.factors });
    },
  });
}

// challenge() then verify(), the pair GoTrue requires. Used for the first code of
// an enrolment, for the challenge at sign-in, and as the gate before un-enrolling —
// in all three the question is the same: does this person hold the factor right now?
async function answerChallenge(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw challengeError;

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw error;
}

export function useVerifyTotp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ factorId, code }: { factorId: string; code: string }) =>
      answerChallenge(factorId, code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twoFactorKeys.factors });
    },
  });
}

// ADR-0001: un-enrolment is gated on a fresh code, not on the session's existing
// assurance level. GoTrue refuses `unenroll` below aal2 anyway, so skipping the
// challenge would just surface a 403 the user cannot act on.
export function useUnenrolTotp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      await answerChallenge(factorId, code);

      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twoFactorKeys.factors });
    },
  });
}

// Abandoning the setup dialog leaves an unverified factor behind, and it counts
// against the ten-factor cap. Cleaning up is what stops repeated cancels from
// eventually locking the user out of enrolling at all.
export function useDiscardEnrolment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: twoFactorKeys.factors });
    },
  });
}
