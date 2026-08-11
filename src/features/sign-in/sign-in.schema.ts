import * as v from "valibot";

export const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("Email is required"),
  v.email("Enter a valid email address"),
);

export type EmailInput = v.InferOutput<typeof emailSchema>;
