/**
 * Shared config for the Contact form. Kept in a plain module — NOT the
 * "use server" action file — so both the client form and the server action
 * can import the types + required-field map and stay in sync.
 */

export type ContactField =
  | "full_name"
  | "email"
  | "phone"
  | "company_name"
  | "website"
  | "additional_notes";

export type ContactSource = "general";

export type ContactState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<ContactField, string>>;
  values?: Partial<Record<ContactField, string>>;
};

export const CONTACT_REQUIRED: Record<ContactSource, ContactField[]> = {
  general: ["full_name", "email", "additional_notes"],
};
