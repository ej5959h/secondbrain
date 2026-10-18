// 쌓인 사용 기록을 events.csv 로 내려받는 스크립트 (구글 시트에서 [파일 → 가져오기]로 열면 돼요)
// 실행: node --env-file=.env.local scripts/export-events.mjs
// - .env.local 의 BLOB_READ_WRITE_TOKEN 은 `vercel env pull` 로 자동으로 들어와요.
// - events.csv 는 개인 기록이라 깃허브에 올리지 않아요 (.gitignore).
import fs from "node:fs";
import { list, get } from "@vercel/blob";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("✗ .env.local 에 BLOB_READ_WRITE_TOKEN 이 없어요. `vercel env pull .env.local` 을 먼저 실행해주세요.");
  process.exit(1);
}

// .env.local 에 VERCEL_OIDC_TOKEN 도 같이 있으면 SDK가 헷갈려서, 저장소 열쇠를 직접 넘겨줘요
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const blobs = [];
let cursor;
do {
  const page = await list({ prefix: "events/", cursor, limit: 1000, token: TOKEN });
  blobs.push(...page.blobs);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

const rows = [];
for (const b of blobs) {
  const r = await get(b.pathname, { access: "private", token: TOKEN });
  if (!r || r.statusCode !== 200) continue;
  rows.push(JSON.parse(await new Response(r.stream).text()));
}
rows.sort((a, b) => a.time.localeCompare(b.time));

const keys = [...new Set(rows.flatMap((r) => Object.keys(r.data || {})))];
const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const toKST = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);
const csv = [
  ["시간(KST)", "이벤트", "사용자(익명)", "페이지", ...keys, "기기"].map(cell).join(","),
  ...rows.map((r) => [toKST(r.time), r.event, r.uid, r.page, ...keys.map((k) => r.data?.[k]), r.ua].map(cell).join(","))
].join("\n");
fs.writeFileSync("events.csv", "﻿" + csv);   // 엑셀·시트에서 한글이 안 깨지게 BOM 추가

const byEvent = rows.reduce((m, r) => ((m[r.event] = (m[r.event] || 0) + 1), m), {});
console.log(`✓ events.csv 저장 · ${rows.length}건 · 사용자 ${new Set(rows.map((r) => r.uid)).size}명`);
console.log(Object.entries(byEvent).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
