/**
 * The contact form's rules, shared by the field and the endpoint.
 *
 * One module rather than two copies on purpose. The browser checks so the
 * reader gets an answer without a round trip; the server checks because the
 * browser's answer is a courtesy and not a control. Anything that drifted
 * between the two would show up as a form that passes locally and is rejected
 * on submit, which is the worst of both.
 *
 * Nothing here may import server-only code: this is pulled into the client
 * bundle by the form.
 */

export const LIMITS = {
  name: 80,
  email: 254,
  message: 4000,
} as const;

/** Shortest message worth sending. Below this it is almost always a bot. */
const MIN_MESSAGE = 10;

/**
 * Deliberately permissive. The only claim being made is that the address has
 * a local part, an @, and a dotted domain. Anything stricter starts rejecting
 * valid addresses, and the real proof that an address works is that the reply
 * arrives.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export type ContactInput = {
  name: string;
  email: string;
  message: string;
};

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

/** Trimmed and length-capped, so the caller never handles raw input. */
export function normalise(input: Partial<ContactInput>): ContactInput {
  return {
    name: (input.name ?? "").trim().slice(0, LIMITS.name),
    email: (input.email ?? "").trim().slice(0, LIMITS.email),
    message: (input.message ?? "").trim().slice(0, LIMITS.message),
  };
}

export function validate(value: ContactInput): ContactErrors {
  const errors: ContactErrors = {};

  if (!value.name) errors.name = "Please enter your name.";
  else if (value.name.length > LIMITS.name)
    errors.name = `Please keep this under ${LIMITS.name} characters.`;

  if (!value.email) errors.email = "Please enter your email address.";
  else if (!EMAIL.test(value.email))
    errors.email = "That does not look like an email address.";

  if (!value.message) errors.message = "Please write a message.";
  else if (value.message.length < MIN_MESSAGE)
    errors.message = "Please write a little more so I can reply usefully.";

  return errors;
}

export function isValid(errors: ContactErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * How long a genuine visitor takes, at minimum, to fill three fields.
 *
 * Paired with the honeypot in the form. Neither is a serious defence on its
 * own, but together they stop the volume of automated submissions that make a
 * public form unusable, and neither costs a real visitor anything.
 */
export const MIN_FILL_MS = 2500;
