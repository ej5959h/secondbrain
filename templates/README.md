# templates/ — 작업 레포에 넣어줄 원본 파일들

`세팅해줘` 하면 클로드가 이 폴더의 파일들을 **멤버의 베프디 작업 레포**에 복사해요.
(멤버가 직접 열어볼 일은 없어요. 운영진 유지보수용입니다.)

| 이 폴더의 파일 | 작업 레포에 복사될 위치 | 역할 |
|---|---|---|
| `deploy.yml` | `.github/workflows/deploy.yml` | push 하면 Vercel에 자동 배포 (시크릿 없으면 조용히 건너뜀) |
| `gitignore` | `.gitignore` | `.env`·`node_modules` 등 올리면 안 되는 파일 자동 제외 |
| `env.example` | `.env.example` | 어떤 비밀 값이 필요한지 이름만 적어두는 견본 |
| `claude-settings.json` | `.claude/settings.json` | 이 레포에서만 적용되는 클로드 보안 차단룰 |

> ⚠️ `deploy.yml`·`env.example` 은 실제 이름 그대로지만, `gitignore` 는 앞에 점을 붙여 `.gitignore` 로,
> `claude-settings.json` 은 `.claude/settings.json` 으로 **이름을 바꿔** 복사됩니다. (SETUP.md 지침 참고)
