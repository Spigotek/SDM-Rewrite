/**
 * ICU MessageFormat — SK má 4 plural-formy (=0, one, few, other), EN 2.
 *
 * Test používa raw `intl-messageformat` aby validoval samotnú knižnicu;
 * provider testy (provider.test.tsx) validujú end-to-end cez i18next pipeline.
 */

import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";

const SK_TICKETS =
  "{count, plural, =0 {žiadne tickety} one {1 ticket} few {# tickety} other {# ticketov}}";
const EN_TICKETS = "{count, plural, =0 {no tickets} one {1 ticket} other {# tickets}}";

describe("ICU plurals — SK 3+exact, EN 2", () => {
  it("SK =0 zero-form", () => {
    const fmt = new IntlMessageFormat(SK_TICKETS, "sk-SK");
    expect(fmt.format({ count: 0 })).toBe("žiadne tickety");
  });

  it("SK one (count=1)", () => {
    const fmt = new IntlMessageFormat(SK_TICKETS, "sk-SK");
    expect(fmt.format({ count: 1 })).toBe("1 ticket");
  });

  it("SK few (count=2..4)", () => {
    const fmt = new IntlMessageFormat(SK_TICKETS, "sk-SK");
    expect(fmt.format({ count: 2 })).toBe("2 tickety");
    expect(fmt.format({ count: 3 })).toBe("3 tickety");
    expect(fmt.format({ count: 4 })).toBe("4 tickety");
  });

  it("SK other (count>=5)", () => {
    const fmt = new IntlMessageFormat(SK_TICKETS, "sk-SK");
    expect(fmt.format({ count: 5 })).toBe("5 ticketov");
    expect(fmt.format({ count: 24 })).toBe("24 ticketov");
    expect(fmt.format({ count: 100 })).toBe("100 ticketov");
  });

  it("EN =0 zero-form", () => {
    const fmt = new IntlMessageFormat(EN_TICKETS, "en-GB");
    expect(fmt.format({ count: 0 })).toBe("no tickets");
  });

  it("EN one + other", () => {
    const fmt = new IntlMessageFormat(EN_TICKETS, "en-GB");
    expect(fmt.format({ count: 1 })).toBe("1 ticket");
    expect(fmt.format({ count: 2 })).toBe("2 tickets");
    expect(fmt.format({ count: 24 })).toBe("24 tickets");
  });
});
