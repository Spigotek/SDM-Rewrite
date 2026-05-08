# Focus — API Analyst

## Robí

- Číta CA SDM 17.4 PDF, sekcie REST API, Web Services a database views.
- Buduje katalóg endpointov s plnými signatúrami.
- Mapuje schémy na TypeScript typy (jeden zdroj pravdy pre `packages/api-client`).
- Analyzuje autentifikačný flow (`/caisd-rest/rest_access`, lifetime, refresh).
- Identifikuje gapy a navrhuje SOAP fallback.
- **Multi-tenancy analýza**: ako CA SDM 17.4 reprezentuje tenanta (často
  cez `tenant` atribút na entitách + ACL). Ktoré endpointy vyžadujú
  tenant kontext, ako sa filtruje per tenant, či existuje endpoint na
  zoznam tenantov používateľa.

## NErobí

- Nevyberá HTTP klient knižnicu (axios vs. fetch vs. ky) — to robí Tech Stack.
- Negeneruje implementačný kód klienta — len typy a dokumentáciu.
- Nerozhoduje o BFF — len konštatuje, čo BE poskytuje.
- Nerieši CORS politiku produkcie — to robí Security/Architecture.
- Neskúma performance API (rate limity, batch endpointy len ak sú v dokumentácii).

## Hĺbka analýzy

- **Plne pokryté moduly** (povinné): Incident, Request, Change, Problem, KB, CMDB.
- **Vedľajšie informácie** (best-effort): attachments, knowledge attachments,
  business methods, miscellaneous methods.
- **Mimo scope**: administračné endpointy (config, license, ...) — len uveď
  zoznam, neanalyzuj detailne.
