import { describe, expect, it } from "vitest";
import { parseSdmResponseBody } from "../src/api/xml-json";

const BOOTSTRAP_OK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rest_access id="402020" REL_ATTR="402020" COMMON_NAME="51299815abc">
  <link href="http://10.11.35.35:8050/caisd-rest/rest_access/402020" rel="self"/>
  <access_key>51299815abc</access_key>
  <expiration_date>1779696034</expiration_date>
</rest_access>`;

const BOOTSTRAP_401_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<error>
    <message>The user name or password you entered is not correct. Please try again.</message>
    <status>401</status>
</error>`;

const CNT_COLLECTION_XML = `<collection_cnt COUNT="1" START="1" TOTAL_COUNT="1">
  <cnt id="U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" REL_ATTR="U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" COMMON_NAME="User, Vue ">
    <link href=".../cnt/U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" rel="self"/>
    <access_type id="10002" REL_ATTR="10002" COMMON_NAME="Administration">
      <link href=".../acctyp/10002" rel="self"/>
    </access_type>
    <email_address>uservue@camp.com</email_address>
    <first_name>Vue</first_name>
    <last_name>User</last_name>
    <userid>vueuser</userid>
  </cnt>
</collection_cnt>`;

const INCIDENT_DETAIL_XML = `<in id="2800" REL_ATTR="cr:2800" COMMON_NAME="SD:01">
  <link href=".../in/2800" rel="self"/>
  <active id="200" REL_ATTR="0" COMMON_NAME="NO"><link href=".../bool/200" rel="self"/></active>
  <close_date>1031839200</close_date>
  <customer id="U'793ED'" REL_ATTR="U'793ED'" COMMON_NAME="System_AHD_generated">
    <link href=".../cnt/U'793ED'" rel="self"/>
  </customer>
  <description>Template Description Service Desk Incident None llll</description>
  <open_date>1031839200</open_date>
  <priority id="505" REL_ATTR="0" COMMON_NAME="None"><link href=".../pri/505" rel="self"/></priority>
  <ref_num>SD:01</ref_num>
  <status id="5201" REL_ATTR="CL" COMMON_NAME="Uzatvorený"><link href=".../crs/5201" rel="self"/></status>
  <summary>Summary Service Desk Incident None</summary>
</in>`;

const EMPTY_TENANT_XML = `<collection_tenant COUNT="0" START="0" TOTAL_COUNT="0"/>`;

interface Parsed {
  rest_access?: { "@id": string; access_key: string; expiration_date: string };
  error?: { message: string; status: string };
  collection_cnt?: {
    "@COUNT": string;
    "@TOTAL_COUNT": string;
    cnt: {
      "@id": string;
      "@COMMON_NAME": string;
      access_type: { "@id": string; "@COMMON_NAME": string };
      email_address: string;
      userid: string;
    };
  };
  in?: {
    ref_num: string;
    open_date: string;
    status: { "@COMMON_NAME": string };
  };
  collection_tenant?: { "@COUNT": string; tenant?: unknown };
}

describe("parseSdmResponseBody — XML inputs (CA SDM 17.4 captures)", () => {
  it("parses bootstrap response (§1) with attributes as @-prefixed string keys", () => {
    const r = parseSdmResponseBody(BOOTSTRAP_OK_XML, "application/xml") as Parsed;
    expect(r.rest_access?.["@id"]).toBe("402020");
    expect(r.rest_access?.access_key).toBe("51299815abc");
    expect(r.rest_access?.expiration_date).toBe("1779696034");
    expect(typeof r.rest_access?.expiration_date).toBe("string");
  });

  it("parses bootstrap 401 error body (§2) into { error: { message, status } }", () => {
    const r = parseSdmResponseBody(BOOTSTRAP_401_XML, "application/xml") as Parsed;
    expect(r.error?.message).toBe(
      "The user name or password you entered is not correct. Please try again.",
    );
    expect(r.error?.status).toBe("401");
  });

  it("parses single-member cnt collection (§4) — child stays an object, not an array", () => {
    const r = parseSdmResponseBody(CNT_COLLECTION_XML, "application/xml") as Parsed;
    expect(r.collection_cnt?.["@COUNT"]).toBe("1");
    expect(r.collection_cnt?.["@TOTAL_COUNT"]).toBe("1");
    expect(Array.isArray(r.collection_cnt?.cnt)).toBe(false);
    expect(r.collection_cnt?.cnt["@id"]).toBe("U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'");
    expect(r.collection_cnt?.cnt.userid).toBe("vueuser");
    expect(r.collection_cnt?.cnt.email_address).toBe("uservue@camp.com");
  });

  it("parses nested FK projection access_type (§4) with @id + @COMMON_NAME", () => {
    const r = parseSdmResponseBody(CNT_COLLECTION_XML, "application/xml") as Parsed;
    expect(r.collection_cnt?.cnt.access_type["@id"]).toBe("10002");
    expect(r.collection_cnt?.cnt.access_type["@COMMON_NAME"]).toBe("Administration");
  });

  it("parses incident detail (§7) — keeps date fields as strings, localises status label", () => {
    const r = parseSdmResponseBody(INCIDENT_DETAIL_XML, "application/xml") as Parsed;
    expect(r.in?.ref_num).toBe("SD:01");
    expect(r.in?.status["@COMMON_NAME"]).toBe("Uzatvorený");
    expect(r.in?.open_date).toBe("1031839200");
    expect(typeof r.in?.open_date).toBe("string");
  });

  it("parses empty collection (§6) — @COUNT='0' and no child key", () => {
    const r = parseSdmResponseBody(EMPTY_TENANT_XML, "application/xml") as Parsed;
    expect(r.collection_tenant?.["@COUNT"]).toBe("0");
    expect(r.collection_tenant).not.toHaveProperty("tenant");
  });
});

describe("parseSdmResponseBody — JSON inputs", () => {
  it("passes JSON through unchanged for application/json", () => {
    expect(parseSdmResponseBody('{"a":1}', "application/json")).toEqual({ a: 1 });
  });

  it("passes JSON through with charset suffix", () => {
    expect(parseSdmResponseBody('{"a":1}', "application/json; charset=utf-8")).toEqual({ a: 1 });
  });
});

describe("parseSdmResponseBody — content-type ambiguity", () => {
  it("parses as XML when body starts with '<' and content-type is null", () => {
    const r = parseSdmResponseBody(CNT_COLLECTION_XML, null) as Parsed;
    expect(r.collection_cnt?.cnt["@id"]).toBe("U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'");
  });

  it("parses as JSON when body starts with '{' and content-type is empty string", () => {
    expect(parseSdmResponseBody('{"a":1}', "")).toEqual({ a: 1 });
  });
});

describe("parseSdmResponseBody — invalid input", () => {
  it("throws when body is neither XML nor JSON under an XML content-type", () => {
    expect(() => parseSdmResponseBody("not-xml-not-json", "application/xml")).toThrow();
  });
});
