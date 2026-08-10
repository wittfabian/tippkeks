import "server-only";

import { serverEnv } from "@/lib/env.server";

/** The provider details the Impressum and Datenschutz pages have to name. */
export interface Operator {
  name: string;
  street: string;
  city: string;
  country: string;
  email: string;
}

/**
 * Resolve who runs this instance from runtime env, or null when nobody is
 * configured. Partial configuration counts as unconfigured on purpose: an
 * Impressum with a silently blank line is worse than one that states it is
 * missing, and only the complete set satisfies § 5 DDG.
 */
export function getOperator(): Operator | null {
  const { OPERATOR_NAME, OPERATOR_STREET, OPERATOR_CITY, OPERATOR_COUNTRY, OPERATOR_EMAIL } =
    serverEnv;

  if (
    !OPERATOR_NAME ||
    !OPERATOR_STREET ||
    !OPERATOR_CITY ||
    !OPERATOR_COUNTRY ||
    !OPERATOR_EMAIL
  ) {
    return null;
  }

  return {
    name: OPERATOR_NAME,
    street: OPERATOR_STREET,
    city: OPERATOR_CITY,
    country: OPERATOR_COUNTRY,
    email: OPERATOR_EMAIL,
  };
}
