// 포춘옷장 아이템 사진을 AI로 한 번에 만들어 assets/items/ 에 저장하는 스크립트
// - Cloudflare Workers AI 무료 사용량(하루 10,000 뉴런)으로 FLUX.1 schnell 모델을 써요.
// - 열쇠는 .env.local 에만 둬요 (깃허브에 안 올라가요):
//     CLOUDFLARE_ACCOUNT_ID=...
//     CLOUDFLARE_API_TOKEN=...
// - 실행: node --env-file=.env.local scripts/generate-items.mjs          (전체)
//         node --env-file=.env.local scripts/generate-items.mjs 3        (앞에서 3장만 시험)
//         node --env-file=.env.local scripts/generate-items.mjs sample   (종류마다 1장씩 시험)
// - 이미 만든 사진은 건너뛰어요. 무료 사용량이 끝나면 멈추고, 다음 날 다시 실행하면 이어서 만들어요.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "assets/items");
const MANIFEST = path.join(OUT, "manifest.json");
const SAMPLE = process.argv[2] === "sample";
// demo: 데모 프로필(아래 DEMO)로 오늘 코디판에 나오는 15개(종류별 옵션 3개)만 만들어요
const DEMO = process.argv[2] === "demo" ? { birth: "1995-03-15", hour: "6", body: "wave", styles: [], gender: "여성" } : null;
const LIMIT = Number(process.argv[2]) || Infinity;

const { CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_API_TOKEN: TOKEN } = process.env;
if (!ACCOUNT || !TOKEN) {
  console.error("✗ .env.local 에 CLOUDFLARE_ACCOUNT_ID 와 CLOUDFLARE_API_TOKEN 을 넣어주세요.");
  process.exit(1);
}

// ---------- index-v5-tryon.html 에서 아이템 목록·컬러를 그대로 읽어와요 ----------
const html = fs.readFileSync(path.join(ROOT, "index-v5-tryon.html"), "utf8");
const slice = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
const ctx = {};
vm.runInNewContext(
  slice("  const ELEMENT_LOOK = {", "  // ---------- 오늘의 운세") +
  slice("  const STYLES = [", "  const BODY_KEYS") +
  "\nthis.ELEMENT_LOOK = ELEMENT_LOOK; this.BODY = BODY; this.CATS = CATS;", ctx);
const { ELEMENT_LOOK, BODY, CATS } = ctx;

// 데모용: 화면과 똑같은 추천 계산(사주 → 행운 오행 → 옵션)을 그대로 돌려서 오늘 나올 아이템 이름을 구해요
function demoNames(profile, date) {
  const c = {};
  vm.runInNewContext(
    slice("  // ---------- 사주 기초 ----------", "  // ---------- 그림:") +
    slice("  // ---------- 추천 아이템 만들기 ----------", "  // ---------- 쇼핑 링크") +
    "\nthis.recommend = recommend; this.CATS = CATS;", c);
  const r = c.recommend(profile, date);
  return new Set(c.CATS.flatMap(([cat]) => r.options[cat].map((it) => it.name)));
}

// ---------- 영어 프롬프트용 이름 (FLUX는 영어를 가장 잘 알아들어요) ----------
const COLOR_EN = {
  세이지: "sage green", 올리브: "olive green", 민트: "pale mint", 코랄: "coral", 버건디: "burgundy", 로즈핑크: "rose pink",
  베이지: "beige", 카멜: "camel", 브라운: "chocolate brown", 아이보리: "ivory", 실버그레이: "silver gray", 화이트: "white",
  네이비: "navy", 블랙: "black", 스카이블루: "sky blue",
  그린스톤: "gold with a green gemstone", 로즈골드: "rose gold", 골드: "gold", 실버: "sterling silver", 블랙오닉스: "silver with black onyx"
};
const ITEM_EN = {
  "하이게이지 브이넥 니트": "fine-gauge V-neck knit sweater", "베이직 옥스퍼드 셔츠": "classic oxford button-down shirt",
  "탄탄한 크루넥 티셔츠": "heavyweight crew-neck T-shirt", "테일러드 싱글 재킷": "tailored single-breasted blazer",
  "실크 셔츠 블라우스": "silk shirt blouse", "스트레이트 슬랙스": "straight-leg tailored trousers",
  "생지 스트레이트 데님": "raw denim straight-leg jeans", "펜슬 스커트": "pencil skirt", "세미와이드 치노 팬츠": "semi-wide chino pants",
  "카고 스트레이트 팬츠": "straight cargo pants", "가죽 페니 로퍼": "leather penny loafers", "미니멀 레더 스니커즈": "minimal leather sneakers",
  "포인티드 슬링백": "pointed-toe slingback heels", "앵클 첼시 부츠": "ankle chelsea boots", "심플 체인 목걸이": "simple chain necklace",
  "메탈 뱅글": "metal bangle bracelet", "작은 링 귀걸이": "small hoop earrings", "시그닛 링": "signet ring",
  "스퀘어 가죽 토트백": "structured square leather tote bag", "로고 볼캡": "baseball cap", "가죽 벨트": "leather belt", "실크 스카프": "silk scarf",
  "숏 기장 리브 가디건": "cropped ribbed cardigan", "퍼프 소매 블라우스": "puff-sleeve blouse", "보트넥 슬림 니트": "boat-neck slim knit top",
  "크롭 후드 집업": "cropped zip-up hoodie", "앙고라 크롭 니트": "fluffy angora cropped sweater",
  "하이웨이스트 플레어 스커트": "high-waisted flared midi skirt", "하이웨이스트 부츠컷 데님": "high-waisted bootcut jeans",
  "머메이드 미디 스커트": "mermaid midi skirt", "하이웨이스트 와이드 슬랙스": "high-waisted wide-leg trousers",
  "나일론 파라슈트 팬츠": "nylon parachute pants", "메리제인 슈즈": "mary jane flats", "스트랩 미들힐": "strappy mid-heel sandals",
  "발레 스니커즈": "ballet sneakers", "스웨이드 앵클부츠": "suede ankle boots", "진주 드롭 귀걸이": "pearl drop earrings",
  "가는 체인 목걸이": "delicate thin chain necklace", "얇은 체인 팔찌": "thin chain bracelet", "하트 링": "heart ring",
  "미니 숄더백": "mini shoulder bag", "얇은 가죽 벨트": "thin leather belt", "새틴 헤어 리본": "satin hair bow ribbon", "쁘띠 스카프": "small neckerchief scarf",
  "오버핏 코튼 셔츠": "oversized cotton shirt", "로우게이지 케이블 니트": "chunky cable-knit sweater", "오버핏 맨투맨": "oversized sweatshirt",
  "린넨 셔츠 재킷": "linen shirt jacket", "드롭숄더 블라우스": "drop-shoulder blouse", "와이드 데님 팬츠": "wide-leg jeans",
  "롱 플리츠 스커트": "long pleated skirt", "코듀로이 와이드 팬츠": "corduroy wide-leg pants", "카고 와이드 팬츠": "wide cargo pants",
  "맥시 슬립 스커트": "satin maxi slip skirt", "레더 첼시 부츠": "leather chelsea boots", "청키 로퍼": "chunky platform loafers",
  "캔버스 하이탑": "canvas high-top sneakers", "니하이 롱부츠": "knee-high leather boots", "볼드 링": "chunky bold ring",
  "볼드 체인 목걸이": "chunky bold chain necklace", "와이드 뱅글": "wide cuff bangle", "빅 링 귀걸이": "large hoop earrings",
  "캔버스 빅 토트백": "large canvas tote bag", "버킷햇": "bucket hat", "울 롱 스카프": "long wool scarf", "와이드 레더 벨트": "wide leather belt",
  "싱글 트렌치코트": "single-breasted trench coat", "울 발마칸 코트": "wool balmacaan coat", "레더 블루종": "leather blouson jacket",
  "브이넥 니트 가디건": "V-neck knit cardigan", "크롭 트위드 재킷": "cropped tweed jacket", "벨티드 트렌치코트": "belted trench coat",
  "노카라 울 코트": "collarless wool coat", "크롭 데님 재킷": "cropped denim jacket", "오버핏 더블 블레이저": "oversized double-breasted blazer",
  "롱 트렌치코트": "long trench coat", "오버핏 핸드메이드 코트": "oversized handmade wool coat", "워크 재킷": "cotton work jacket",
  "로우게이지 롱 가디건": "chunky long cardigan"
};
const SHOT = {
  top: "flat lay, garment laid flat and neatly arranged, top-down view, no mannequin, no hanger",
  bottom: "flat lay, laid flat full length, top-down view, no mannequin, no hanger",
  shoes: "a pair, three-quarter side view",
  jewelry: "jewelry displayed alone on a plain white surface, product close-up, no person, no neck, no hands, no model",
  acc: "front view",
  outer: "flat lay, garment laid flat and neatly arranged, top-down view, no mannequin, no hanger"
};

// ---------- 만들 목록 (중복 없이) ----------
const jobs = new Map();
for (const body of ["straight", "wave", "natural"]) {
  for (const [cat] of CATS) {
    for (const [base] of BODY[body].items[cat]) {
      const colors = cat === "jewelry"
        ? Object.values(ELEMENT_LOOK).map((l) => l.tone[0])
        : Object.values(ELEMENT_LOOK).flatMap((l) => l.colors.map((c) => c[0]));
      for (const color of colors) {
        const name = `${color} ${base}`;
        if (jobs.has(name)) continue;
        if (!ITEM_EN[base] || !COLOR_EN[color]) throw new Error(`영어 이름이 없어요: ${name}`);
        jobs.set(name, {
          name, cat,
          file: `${crypto.createHash("sha1").update(name).digest("hex").slice(0, 12)}.jpg`,
          prompt: `Professional e-commerce product photo of a single ${COLOR_EN[color]} ${ITEM_EN[base]}, ${SHOT[cat]}, ` +
            "isolated on a pure white background, centered with generous margin, soft even studio lighting, " +
            "realistic fabric texture, high detail, no person, no text, no logo, no watermark"
        });
      }
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
let todo = [...jobs.values()].filter((j) => !(manifest[j.name] && fs.existsSync(path.join(OUT, j.file))));
if (SAMPLE) todo = CATS.map(([cat]) => todo.find((j) => j.cat === cat)).filter(Boolean);
if (DEMO) { const want = demoNames(DEMO, new Date()); todo = todo.filter((j) => want.has(j.name)); console.log("데모 아이템:", [...want].join(", ")); }
todo = todo.slice(0, LIMIT);
console.log(`전체 ${jobs.size}장 중 이미 ${jobs.size - [...jobs.values()].filter((j) => !manifest[j.name]).length}장 있음 · 이번에 ${todo.length}장 만들어요`);

const saveManifest = () => fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
let made = 0, stop = false;

async function generate(job) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: job.prompt, steps: 4 })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.result?.image) {
    const msg = JSON.stringify(data.errors || data).slice(0, 300);
    if (r.status === 429 || /allocation|quota|limit/i.test(msg)) { stop = true; throw new Error(`무료 사용량 끝 (${r.status}) — 내일 다시 실행하면 이어서 만들어요`); }
    throw new Error(`${r.status} ${msg}`);
  }
  const full = path.join(OUT, job.file);
  fs.writeFileSync(full, Buffer.from(data.result.image, "base64"));
  // 화면에선 작게 보여서 384px로 줄여 저장해요 (레포 용량 아끼기, macOS sips 사용)
  try { execFileSync("sips", ["-Z", "384", "-s", "formatOptions", "72", full], { stdio: "ignore" }); } catch {}
  manifest[job.name] = `assets/items/${job.file}`;
  made++;
  if (made % 10 === 0) { saveManifest(); console.log(`  ${made}/${todo.length}`); }
}

const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length && !stop) {
    const job = queue.shift();
    try { await generate(job); } catch (e) { console.error(`✗ ${job.name}: ${e.message}`); if (stop) break; }
  }
}));
saveManifest();
console.log(`완료: 이번에 ${made}장 · 전체 ${Object.keys(manifest).length}/${jobs.size}장`);
if ([...jobs.keys()].every((n) => manifest[n])) console.log("ALL_DONE");   // 자동 실행 스크립트가 이걸 보고 멈춰요
