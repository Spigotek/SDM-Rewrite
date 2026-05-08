# CA SDM 17.4 — verzie API a kompatibilita

> Cieľ: zdokumentovať stabilitu cieľového rozhrania, identifikovať verzie
> sub-API (REST primárny vs. BUI/Service Point) a riziká spojené s patchami.

## Hlavná verzia produktu

| Položka | Hodnota | Zdroj |
|---|---|---|
| Produkt | CA Service Management | `docs/ca-service-management-17-4.pdf`, hlavička každej strany |
| Verzia | **17.4** | PDF hlavička, všetky strany |
| Codename | nie je verejne uvedený v PDF (Broadcom interný) | — |
| Kód balíka REST API | `caisd-rest` (web app v Tomcat-u) | s. 3439 |
| Kód balíka SOAP | `axis/services/USD_R11` | konvenčný path z dokumentácie |

## Sub-API verzie

CA SDM 17.4 obsahuje **viaceré paralelné REST API vrstvy**, ktoré majú
**rôzne verzie a rôzny lifecycle**:

| Vrstva | Path | Verzia / OpenAPI | Stabilita | Use case |
|---|---|---|---|---|
| **CA SDM REST (primárny)** | `/caisd-rest/...` | nie je explicitne verzionované; verzia sa odvíja od product release (17.4.x) | High — backward compatibility v rámci 17.x je deklarovaná | Hlavné CRUD operácie; preferované |
| **CA Service Point (BUI)** | `/api`, `/bui`, `/gs`, `/getOfferings`, `/pcatSearch`, ... | swagger v PDF deklaruje `"version": "Leh-17.2 GA"` (s. 2912) | Medium — stabilizované v 17.2, ale UI-driven; release cycle iný ako primárny REST | Service Catalog UI, KB suggested solutions, Service Point widgety |
| **CA SDM SOAP (legacy)** | `/axis/services/USD_R11` | `r11.0` shape + extensions od `r11.1`, `r11.2`, `r12.x`, `r17.x` | High — legacy stable; nové funkcie sa len-zriedkavo pridávajú | Operácie, kde REST nestačí (viď `soap-fallback.md`) |

### Service Point swagger verzia

V PDF s. 2912 je jasne uvedené:

```json
{
  "swagger": "2.0",
  "info": {
    "version": "Leh-17.2 GA",
    "title": "Service Point REST End Points",
    ...
  }
}
```

To znamená: **Service Point endpoints v 17.4 sú totožné s 17.2 GA**.
Žiadny breaking change od 17.2.

## Kompatibilita s 17.4 sub-releasmi

Broadcom releasuje patch-update s číslom za bodkou (`17.4.0`, `17.4.1`,
`17.4.2`, ...). Z PDF sa konkrétny patch (`.x`) nedá určiť — dokument hovorí
len "17.4". Predpoklad:

- **17.4.0 .. 17.4.x**: REST API kontrakt **nesmie** breaking-meniť patch-mi.
  Iba bug fix-y a nové optional polia.
- **17.5+**: TBD; pri upgrade FE musí adopt nové schémy. Žiadny zatiaľ
  oznámený sunset existujúcich endpointov.

> ⚠️ V PDF nie je explicitný "deprecation notice" pre žiadny endpoint. Ale
> v `chg_trans` / `pr_trans` sekciách (s. 3854 a s. 3823) sa hovorí o
> dependent_control / atribútoch, ktoré sa môžu meniť cez Majic MODIFY —
> teda customer customizations menia REST kontrakt. **Treba to považovať
> za risk pre integráciu** — ak na reálnej inštancii má customer custom
> atribúty, FE bude musieť o nich vedieť.

## Verzie podporované klientom

| Klient | Min CA SDM | Odporučené | Max CA SDM |
|---|---|---|---|
| Nový FE (Portal + Workspace) | 17.4.0 | 17.4.x najnovší dostupný | 17.4.x |
| Mock backend (DevOps) | matches schema 17.4 | — | — |

Pre `v1` etapu zvážime forward-compat na 17.5 (ak vyjde), ale v MVP držíme
striktne 17.4.

## Súbor `info` endpoint?

CA SDM **neexponuje žiadny REST endpoint `/version`** alebo `/info`. Verzia
sa overí cez:
- Web client landing page (HTML s `meta` tagom).
- Service Point endpoint `GET /bui/helpAbout` (vracia info o produktovej
  verzii).
- SOAP `getServerInfo` method.

Pre BFF zdravostný check odporúčame `GET /caisd-rest/sevrty?size=1`
(authenticated, latency-ish), nie verziu. Verziu BFF si zacachuje pri
deployi cez environment variable.

## Customer-driven schema drift

CA SDM podporuje **schema customization** cez Majic files:

- `MODIFY FACTORY cr { REST_OPERATIONS "READ UPDATE"; }` — customer môže
  zakázať CREATE/DELETE.
- `MODIFY FACTORY cr { ... }` — customer môže pridať custom atribúty.
- `MODIFY FACTORY cr { REST_OPERATIONS "NONE"; }` — vypne objekt z REST.

**Dôsledok pre FE**: nemôžeme predpokladať, že každá inštancia má všetky
endpointy. Pre robustný klient odporúčame:
1. Pri štarte BFF zavolať na `/caisd-rest/<factory>` GET so size=0 a overiť
   401/200 vs. 405. Cache výsledok.
2. Feature-flagovať UI komponenty podľa toho, ktoré objekty sú dostupné.

> Tento defensive flow detail je úloha 04-architecture (BFF design) a
> 09-qa (test stratégia voči customizáciám).

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `target-patch-version` | → 04-architecture, 08-devex-devops | Konkrétny patch level (17.4.0 vs. 17.4.x) zatiaľ nie je rozhodnutý — určí ho on-prem inštalácia. Mock backend a integration tests nech sú konfigurovateľné. |
| 2 | `customer-customization-detection` | → 04-architecture | Defensive feature-detection flow (overiť dostupné REST factories pri štarte BFF) je open question — či sa to robí v každom requeste, alebo na BFF startup. |
| 3 | `forward-compat-policy` | → 04-architecture | Či pri vydaní 17.5 podporujeme oba (17.4 + 17.5) v jednom binárny FE, alebo per-deployment matching. |
