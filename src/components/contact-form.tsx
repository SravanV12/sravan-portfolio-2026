"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Magnetic } from "@/components/magnetic";
import {
  LIMITS,
  isValid,
  normalise,
  validate,
  type ContactErrors,
  type ContactInput,
} from "@/lib/contact";

/**
 * The contact form.
 *
 * Posts to `/api/contact`, which is what keeps the provider credential out of
 * the browser. Nothing here knows how the message is delivered, only that the
 * endpoint either accepted it or did not.
 *
 * Validation runs twice over: here so a mistake is caught before a round trip,
 * and again on the server, which is the check that actually counts. Both sides
 * import the same rules so the two can never disagree.
 *
 * The reader is told what is happening at every point. Errors are tied to their
 * field with `aria-describedby`, the field is marked `aria-invalid`, and the
 * outcome is announced through a live region rather than only being shown.
 */

type Status = "idle" | "sending" | "sent" | "error";

const EMPTY: ContactInput = { name: "", email: "", message: "" };

export function ContactForm() {
  const id = useId();
  const [value, setValue] = useState<ContactInput>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<string | null>(null);

  // When the form was rendered, used by the endpoint to reject submissions
  // that arrive impossibly fast. Written in an effect rather than during
  // render, which must stay pure.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Guards against a second submission landing while the first is in flight,
  // which a double click or an impatient Enter will otherwise produce. The
  // button is disabled too; this is the part that cannot be raced.
  const sending = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const fieldError = (key: keyof ContactInput) => errors[key];

  const update = (key: keyof ContactInput) => (event: { target: { value: string } }) => {
    setValue((current) => ({ ...current, [key]: event.target.value }));
    // Clear a field's error as soon as it is touched. Leaving it up while
    // someone is fixing it reads as the form arguing with them.
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;

    const cleaned = normalise(value);
    const found = validate(cleaned);
    setErrors(found);

    if (!isValid(found)) {
      // Send focus to the first field that needs attention.
      const first = (["name", "email", "message"] as const).find((k) => found[k]);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }

    sending.current = true;
    setStatus("sending");
    setFailure(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cleaned,
          startedAt: startedAt.current,
          // Honeypot, always empty for anyone who can see the page.
          company: "",
        }),
      });

      if (response.ok) {
        setStatus("sent");
        setValue(EMPTY);
        setErrors({});
        return;
      }

      const data = await response.json().catch(() => null);
      if (response.status === 422 && data?.errors) {
        setErrors(data.errors as ContactErrors);
        setStatus("idle");
        return;
      }

      setFailure(
        typeof data?.error === "string"
          ? data.error
          : "The message could not be sent. Please email me directly.",
      );
      setStatus("error");
    } catch {
      setFailure(
        "The message could not be sent. Please check your connection, or email me directly.",
      );
      setStatus("error");
    } finally {
      sending.current = false;
    }
  }

  // Move focus to the outcome once there is one, so it is not something a
  // screen-reader user has to go hunting for.
  useEffect(() => {
    if (status === "sent" || status === "error") statusRef.current?.focus();
  }, [status]);

  const busy = status === "sending";

  return (
    <form onSubmit={onSubmit} noValidate className="contact-form">
      <div className="grid gap-8 sm:grid-cols-2">
        <Field
          id={`${id}-name`}
          label="Name"
          error={fieldError("name")}
          maxLength={LIMITS.name}
          autoComplete="name"
          value={value.name}
          onChange={update("name")}
          disabled={busy}
        />
        <Field
          id={`${id}-email`}
          label="Email"
          type="email"
          inputMode="email"
          error={fieldError("email")}
          maxLength={LIMITS.email}
          autoComplete="email"
          value={value.email}
          onChange={update("email")}
          disabled={busy}
        />
      </div>

      <Field
        id={`${id}-message`}
        label="Message"
        multiline
        error={fieldError("message")}
        maxLength={LIMITS.message}
        value={value.message}
        onChange={update("message")}
        disabled={busy}
        className="mt-8"
      />

      {/*
        Honeypot. Out of the accessibility tree and out of the tab order, so
        nobody using the page can reach it, while a bot filling every input
        will. Not `display: none`, which is the first thing a bot checks for.
      */}
      <div className="contact-trap" aria-hidden="true">
        <label htmlFor={`${id}-company`}>Company</label>
        <input
          id={`${id}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Magnetic>
          <button
            type="submit"
            disabled={busy}
            className="text-mono border-line hover:border-accent hover:text-accent focus-visible:border-accent inline-flex items-center gap-3 border-b px-1 pt-3 pb-2 uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending" : "Send message"}
            <span aria-hidden="true">{busy ? "…" : "→"}</span>
          </button>
        </Magnetic>

        {/*
          One live region for every outcome. Polite, so it waits for a natural
          pause rather than cutting across whatever is being read.
        */}
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={
            status === "error"
              ? "text-small text-accent outline-none"
              : "text-small text-muted outline-none"
          }
        >
          {status === "sending" ? "Sending your message." : null}
          {status === "sent"
            ? "Message sent successfully. I'll get back to you soon."
            : null}
          {status === "error" ? failure : null}
        </p>
      </div>
    </form>
  );
}

/**
 * One labelled field.
 *
 * The label is a real, visible `<label>`. Using the placeholder as the label
 * is the usual shortcut and it fails the moment someone starts typing, which
 * is exactly when they most need to know what the field was.
 */
function Field({
  id,
  label,
  error,
  multiline,
  className,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  multiline?: boolean;
  className?: string;
  type?: string;
  inputMode?: "email";
  maxLength?: number;
  autoComplete?: string;
  value: string;
  disabled?: boolean;
  onChange: (event: { target: { value: string } }) => void;
}) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    name: id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? errorId : undefined,
    className: "contact-input",
    ...props,
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="text-mono text-muted block uppercase">
        {label}
      </label>

      {multiline ? (
        <textarea {...shared} rows={5} />
      ) : (
        <input {...shared} type={props.type ?? "text"} />
      )}

      {error ? (
        <p id={errorId} className="text-small text-accent mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
