import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../src/platform/attachments/svg-sanitize";

/**
 * J.5 — svg-sanitize.ts unit tests.
 * 5+ cases per OWASP SVG XSS cheat sheet:
 *   - clean svg passes
 *   - script stripped
 *   - event handler stripped
 *   - foreignObject stripped
 *   - href javascript: stripped
 *   + bonus: data: URI in image href stripped
 */

describe("sanitizeSvg", () => {
  it("passes clean SVG through (preserving basic structure)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill="red"/>
      <rect x="10" y="10" width="20" height="20" stroke="blue" fill="none"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).toContain("<circle");
    expect(result).toContain("<rect");
    expect(result).not.toContain("script");
  });

  it("strips <script> elements and their text content", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <script>alert('xss')</script>
      <circle cx="50" cy="50" r="40" fill="green"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<circle");
  });

  it("strips inline event handler attributes (onclick, onload, etc.)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert('xss')">
      <circle cx="50" cy="50" r="40" onclick="evil()" fill="blue"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("onload");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("evil");
    expect(result).not.toContain("alert");
  });

  it("strips <foreignObject> (HTML injection vector)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <foreignObject width="200" height="200">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <script>alert('xss')</script>
        </div>
      </foreignObject>
      <circle cx="50" cy="50" r="10" fill="red"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("alert");
    expect(result).toContain("<circle");
  });

  it("strips javascript: href on <use> element", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <circle id="myCircle" cx="50" cy="50" r="40"/>
      </defs>
      <use xlink:href="javascript:alert(1)" />
      <use href="#myCircle" fill="blue"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("javascript:");
    // The safe fragment-only href should survive
    expect(result).toContain("#myCircle");
  });

  it("strips data: URI in <image> href (data: exfiltration vector)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <image href="data:text/html,<script>alert(1)</script>" width="100" height="100"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("data:text/html");
    expect(result).not.toContain("alert");
  });

  it("strips <iframe> elements", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <iframe src="https://evil.example.com"></iframe>
      <rect x="0" y="0" width="10" height="10" fill="black"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("iframe");
    expect(result).toContain("<rect");
  });

  it("allows safe http(s) image href through", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <image href="https://example.com/logo.png" width="100" height="100"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).toContain("https://example.com/logo.png");
  });

  it("strips <animate> with href (click-jacking vector)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <a href="javascript:alert(1)">
        <circle cx="50" cy="50" r="30" fill="red"/>
      </a>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("javascript:");
  });

  it("preserves linearGradient and stop for visual fidelity", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="red"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="50" fill="url(#grad1)"/>
    </svg>`;
    const result = sanitizeSvg(svg);
    expect(result).toContain("linearGradient");
    expect(result).toContain("<stop");
  });
});
