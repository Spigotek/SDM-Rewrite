# Inputs — API Analyst

## Primárny zdroj

- `docs/ca-service-management-17-4.pdf` (4301 strán)

### Page ranges (z TOC)

| Strany | Sekcia |
|---|---|
| 286–296 | CA Service Management Solution Architecture (kontext) |
| 1398–1842 | Web Services for CA SDM — Best Practices |
| 1843–2500 | Web Services Management |
| 2501–2905 | Database Views (read-model — informačné) |
| **2906–3394** | **REST API** ⭐ |
| 2907–3000 | REST API — Service Point |
| 3395–3461 | Web Services Methods |
| 3436–3461 | REST HTTP Methods |
| 3462–3475 | Web Services Attachment Methods |
| 3465–3516 | Web Services Knowledge Methods |
| 3517–3765 | Web Services Business Methods |
| **3766–4012** | **API Documentation for RESTful Services** ⭐ |
| 4013+ | DatabaseInstance reference |

## Kontextové dokumenty

- `GOAL.md` — sekcie §2 (Backend) a §3 (Scope), §6 (deferred decisions).
- `.agents/01-api-analyst/preferences.md` — formát výstupu.

## Bash príklady

```bash
# extrahuj REST API úvod
pdftotext -layout -f 2906 -l 3000 docs/ca-service-management-17-4.pdf - > /tmp/rest-2906.txt
# extrahuj RESTful Services dokumentáciu
pdftotext -layout -f 3766 -l 4012 docs/ca-service-management-17-4.pdf - > /tmp/rest-3766.txt
```
