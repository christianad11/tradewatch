import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the artifact-backed research dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /TradeWatch Lebanon/);
  assert.match(html, /4,931/);
  assert.match(html, /Research signal, not an accusation/);
  assert.match(html, /Anomaly explorer/);
  assert.doesNotMatch(html, /fraud detected/i);
  assert.doesNotMatch(html, /codex-preview/);
});

test("renders the artifact-backed AI explainer without accusatory claims", async () => {
  const response = await render("/ai");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /How TradeWatch turns trade data into an/);
  assert.match(html, /4,931/);
  assert.match(html, /100%/);
  assert.match(html, /Unusual is not unlawful/);
  assert.doesNotMatch(html, /fraud detected/i);
  assert.doesNotMatch(html, /codex-preview/);
});
