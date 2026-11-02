/** All byte counts remain decimal strings in machine-readable output. */

import type {Audit} from "./audit.ts";

export function jsonReport(result: Audit): string {
  return JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2) + "\n";
}

export function textReport(result: Audit): string {
  const lines = [result.name,
    `Total: ${result.totalBytes} bytes | Ranges: ${result.rangeCount} | Submitted: ${result.submittedBytes} bytes`,
    `Covered: ${result.coveredBytes} | Missing: ${result.missingBytes} | Overlap: ${result.overlapBytes} | Redundant: ${result.redundantBytes}`,
    `Maximum depth: ${result.maxDepth} | Complete: ${result.complete} | Exact: ${result.exact}`,
    "", "Coverage segments [start, end):"];
  for (const segment of result.segments) {
    const label = segment.depth === 0 ? "MISSING" : segment.depth === 1 ? "covered" : "OVERLAP";
    lines.push(`  [${segment.start}, ${segment.end}) depth=${segment.depth} ${label}`);
  }
  if (result.segments.length === 0) lines.push("  (empty target)");
  lines.push("", "This audits declared ranges only; it does not read or verify uploaded bytes.");
  return lines.join("\n") + "\n";
}

function escape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function svgReport(result: Audit): string {
  // Integer scaling first: byte offsets never pass through floating-point Number.
  const x = (offset: bigint): number => result.totalBytes === 0n ? 60 :
    60 + Number(offset * 880_000n / result.totalBytes) / 1000;
  const bars = result.segments.map(segment => {
    const color = segment.depth === 0 ? "#ffbf69" : segment.depth === 1 ? "#65d6ad" : "#ff7e8c";
    return `<rect x="${x(segment.start)}" y="260" width="${x(segment.end) - x(segment.start)}" height="76" fill="${color}"><title>[${segment.start}, ${segment.end}) — depth ${segment.depth}</title></rect>`;
  }).join("\n");
  const title = escape(result.name);
  const empty = result.totalBytes === 0n ? '<text x="60" y="302" fill="#c9d5e7">Empty target: no ranges required.</text>' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 480" role="img" aria-labelledby="title desc">
<title id="title">Range Audit — ${title}</title>
<desc id="desc">${result.coveredBytes} covered bytes, ${result.missingBytes} missing bytes, ${result.overlapBytes} overlapping bytes. Exact: ${result.exact}. Tiny ranges may not be visible; use text or JSON for exact boundaries.</desc>
<rect width="1000" height="480" rx="20" fill="#0c1420"/>
<g font-family="system-ui, sans-serif" fill="#edf3fc">
<text x="60" y="49" font-size="13" letter-spacing="2" fill="#65d6ad">RANGE AUDIT / OFFLINE MANIFEST CHECK</text>
<foreignObject x="60" y="66" width="880" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="font:600 20px/1.25 system-ui,sans-serif;color:#edf3fc;overflow-wrap:anywhere">${title}</div></foreignObject>
<text x="60" y="171" font-size="16">Total ${result.totalBytes} bytes</text>
<text x="520" y="171" font-size="16">${result.rangeCount} ranges · max depth ${result.maxDepth}</text>
<text x="60" y="200" font-size="16" fill="#c9d5e7">Missing ${result.missingBytes} bytes</text>
<text x="520" y="200" font-size="16" fill="#c9d5e7">Overlap ${result.overlapBytes} bytes</text>
<text x="60" y="229" font-size="16" fill="#c9d5e7">Redundant ${result.redundantBytes} bytes</text>
<rect x="60" y="260" width="880" height="76" rx="4" fill="#233247"/>
${bars}${empty}
<text x="60" y="362" font-size="14">0</text><text x="940" y="362" text-anchor="end" font-size="14">${result.totalBytes} bytes</text>
<circle cx="67" cy="396" r="7" fill="#65d6ad"/><text x="83" y="401" font-size="15">Covered once</text>
<circle cx="267" cy="396" r="7" fill="#ffbf69"/><text x="283" y="401" font-size="15">Missing</text>
<circle cx="427" cy="396" r="7" fill="#ff7e8c"/><text x="443" y="401" font-size="15">Overlap</text>
<text x="60" y="441" font-size="14" fill="#c9d5e7">Metadata only. Tiny intervals may disappear at this scale; text/JSON reports retain exact offsets.</text>
</g></svg>\n`;
}
