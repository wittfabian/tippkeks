import type { Operator } from "@/lib/legal/operator";
import { de } from "@/messages/de";

/** Postal block for the site operator, repeated across Impressum and Datenschutz. */
export function OperatorAddress({
  operator,
  showCountry = true,
}: {
  operator: Operator;
  showCountry?: boolean;
}) {
  return (
    <address className="text-foreground not-italic">
      {operator.name}
      <br />
      {operator.street}
      <br />
      {operator.city}
      {showCountry ? (
        <>
          <br />
          {operator.country}
        </>
      ) : null}
    </address>
  );
}

/** Contact mailto line, styled like the surrounding legal body copy. */
export function OperatorEmail({ operator }: { operator: Operator }) {
  return (
    <p>
      {de.legal.operator.emailLabel}:{" "}
      <a className="hover:text-foreground underline" href={`mailto:${operator.email}`}>
        {operator.email}
      </a>
    </p>
  );
}

/** Shown in place of the operator details when this deployment configured none. */
export function OperatorMissing() {
  return <p>{de.legal.operator.missing}</p>;
}
