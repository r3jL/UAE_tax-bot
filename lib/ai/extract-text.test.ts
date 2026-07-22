import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { extractFileText } from "./extract-text";

test("xlsx extraction includes sheet names, cells and formula results", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Q2 VAT");
  ws.addRow(["Item", "Net", "VAT"]);
  ws.addRow(["Local sales", 1250000, { formula: "B2*0.05", result: 62500 }]);
  const buf = new Uint8Array(await wb.xlsx.writeBuffer());

  const doc = await extractFileText({
    bytes: buf,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "q2.xlsx",
  });
  assert.ok(doc.text.includes("Q2 VAT"));
  assert.ok(doc.text.includes("Local sales"));
  assert.ok(doc.text.includes("62500")); // formula → computed result
});

test("csv extraction passes text through", async () => {
  const csv = "vendor,amount\nGulf Media,10000\n";
  const doc = await extractFileText({
    bytes: new TextEncoder().encode(csv),
    mimeType: "text/csv",
    filename: "vendors.csv",
  });
  assert.equal(doc.text, csv);
});

test("unsupported type gets a helpful error", async () => {
  await assert.rejects(
    () =>
      extractFileText({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "application/zip",
        filename: "x.zip",
      }),
    /Unsupported file/,
  );
});
