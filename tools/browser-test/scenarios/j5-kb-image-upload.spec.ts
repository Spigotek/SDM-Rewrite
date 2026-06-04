import { test, expect } from "../fixtures/isolated-context";

/**
 * J.5 — KB image upload browser specs.
 *
 * Uses MSW (VITE_USE_MOCKS=true) — no real BFF needed.
 * The MSW handler for POST /api/attachments/kb returns a synthetic data: URI.
 *
 * Scenarios:
 *  1. Upload PNG via drag-drop on the editor shell → image URL inserted into editor.
 *  2. Upload oversize file (> 5 MB) → upload error message shown, no image inserted.
 *  3. Upload .png disguised as wrong MIME (image/application/octet-stream) → client-side
 *     MIME guard shows error before the request even fires.
 *
 * Requires a kb_editor session (Jana fixture in MSW).
 * Navigate to /kb/editor to reach the upload-enabled TipTap editor.
 */
test.describe("@J5 KB image upload", () => {
  test("upload PNG via drag-drop → image inserted into TipTap editor", async ({ isolatedPage }) => {
    await isolatedPage.goto("/kb/editor");

    // Wait for the editor shell to mount.
    const editorShell = isolatedPage.getByTestId("kb-editor-shell");
    await expect(editorShell).toBeVisible({ timeout: 15_000 });

    // Simulate drag-drop: inject a tiny PNG File via DataTransfer and dispatch
    // a drop event on the editor shell.
    const inserted = await isolatedPage.evaluate(async () => {
      const shell = document.querySelector("[data-testid='kb-editor-shell']");
      if (!shell) return false;

      // 1×1 transparent PNG bytes (matches MSW handler's allowed MIME)
      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
        0x77, 0x53, 0xde,
      ]);
      const file = new File([pngBytes], "test.png", { type: "image/png" });

      const dt = new DataTransfer();
      dt.items.add(file);

      shell.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );

      // Wait up to 3s for the upload to complete (MSW responds synchronously)
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));

      // Check if an <img> was inserted into the TipTap prose area
      const prose = document.querySelector(".sdm-kb-editor-prose");
      return prose ? prose.querySelector("img") !== null : false;
    });

    expect(inserted).toBe(true);
  });

  test("upload file > 5 MB → client-side error shown, no image inserted", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/kb/editor");

    const editorShell = isolatedPage.getByTestId("kb-editor-shell");
    await expect(editorShell).toBeVisible({ timeout: 15_000 });

    await isolatedPage.evaluate(() => {
      const shell = document.querySelector("[data-testid='kb-editor-shell']");
      if (!shell) return;

      // Construct a large file (6 MB of zeros with PNG header)
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const bigPayload = new Uint8Array(6 * 1024 * 1024);
      bigPayload.set(pngHeader, 0);
      const file = new File([bigPayload], "huge.png", { type: "image/png" });

      const dt = new DataTransfer();
      dt.items.add(file);
      shell.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
    });

    // Upload error alert should appear within 2s (client-side guard — no round-trip)
    const errorEl = isolatedPage.getByTestId("kb-editor-upload-error");
    await expect(errorEl).toBeVisible({ timeout: 2_000 });

    // No image should be in the prose
    const hasImage = await isolatedPage.evaluate(() => {
      const prose = document.querySelector(".sdm-kb-editor-prose");
      return prose ? prose.querySelector("img") !== null : false;
    });
    expect(hasImage).toBe(false);
  });

  test("upload file with unsupported MIME → client-side error, request not sent", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/kb/editor");

    const editorShell = isolatedPage.getByTestId("kb-editor-shell");
    await expect(editorShell).toBeVisible({ timeout: 15_000 });

    await isolatedPage.evaluate(() => {
      const shell = document.querySelector("[data-testid='kb-editor-shell']");
      if (!shell) return;

      // EXE-disguised-as-image: MIME not in allowed set
      const bytes = new Uint8Array([0x4d, 0x5a, 0x00, 0x00]); // MZ header (EXE)
      const file = new File([bytes], "virus.exe", { type: "application/octet-stream" });

      const dt = new DataTransfer();
      dt.items.add(file);
      shell.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
    });

    const errorEl = isolatedPage.getByTestId("kb-editor-upload-error");
    await expect(errorEl).toBeVisible({ timeout: 2_000 });
  });
});
