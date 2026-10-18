// 사용 기록 저장 서버
// - 브라우저 → /api/log → Vercel Blob(비공개 저장소)에 이벤트 1건 = 파일 1개로 쌓아요
// - 저장소 열쇠(BLOB_READ_WRITE_TOKEN)는 Vercel이 자동으로 넣어줬어요. 코드·브라우저에는 안 나가요.
// - 모아보기: node --env-file=.env.local scripts/export-events.mjs → events.csv (구글 시트로 바로 열 수 있어요)
// - 이름·생년월일 전체·사진은 보내지 않아요. (개인정보 최소화)
import { put } from "@vercel/blob";

const EVENTS = new Set(["profile_saved", "result_view", "item_detail", "try_item", "shop_click", "outfit_saved", "review_saved", "next_week_open"]);
const clean = (v, max = 200) => String(v ?? "").replace(/[\r\n\t]+/g, " ").slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 받아요" });
  if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error("BLOB_READ_WRITE_TOKEN 없음"); return res.status(503).end(); }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const event = clean(body?.event, 40);
  if (!EVENTS.has(event)) return res.status(400).json({ error: "모르는 이벤트예요" });

  const now = new Date();
  const row = {
    time: now.toISOString(),
    event,
    uid: clean(body.uid, 40),
    page: clean(body.page, 60),
    data: body.data && typeof body.data === "object" && JSON.stringify(body.data).length <= 1500 ? body.data : {},
    ua: clean(req.headers["user-agent"], 160)
  };
  const day = row.time.slice(0, 10);
  const id = `${row.time.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await put(`events/${day}/${id}.json`, JSON.stringify(row), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return res.status(204).end();
  } catch (e) {
    console.error("기록 저장 실패:", e?.message);
    return res.status(502).end();
  }
}
