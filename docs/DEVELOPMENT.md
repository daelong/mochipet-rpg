# 웹 개발·검사·빌드

Node.js 22.12 이상, pnpm 10.28.2가 필요합니다. Phase 1은 로컬 브라우저 저장만 사용하므로 DB·API·비밀값을 설정하지 않습니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

개발 주소는 `http://127.0.0.1:5173/`, 빌드 출력은 `apps/web/dist/`입니다. `pnpm --filter @mochi/web preview --port 4173`으로 빌드 결과를 확인할 수 있습니다. HTTPS 또는 localhost가 Web Locks에 필요하며, 기능이 없거나 다른 탭이 잠금을 보유하면 플레이와 저장을 차단합니다.

```sh
MOCHI_E2E_PRODUCTION=1 pnpm test:e2e
```

위 명령은 먼저 `pnpm build`한 뒤 실행합니다. Playwright가 4173에서 프로덕션 미리보기 서버를 시작하고 검사 종료 후 정리합니다. 기존 Chromium 실행 파일을 사용하려면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`에 해당 실행 파일 경로를 지정할 수 있습니다. 모바일 프로젝트는 Chromium의 터치 입력·모바일 뷰포트 검사이며 실제 Android/iOS 검사와 다릅니다.

`pnpm build`는 리소스 경로 검사 → 웹 CSV 일치 검사 → 전체 TypeScript 타입 검사 → Vite 빌드를 수행합니다. CSV는 `pnpm catalogs`로 생성하고 `pnpm catalogs:check`로 확인합니다. 데이터 변경 시 집 안 활동을 포함한 6종의 `web-*.csv`도 함께 갱신하세요. `pnpm format`은 웹 소스의 서식만 정리합니다.

사냥터 변경 검사는 `pnpm test:e2e --grep "separate field|automatic recovery|zone and character|level 20"`로 실행할 수 있습니다. 사냥터 입장 시 생성 5마리·무작위 위치·자동 보상·OFF 후 보상 중단·마당 복귀·회복 후 재개를 확인합니다. 몬스터 인스턴스와 위치는 재접속 후 이어지지 않습니다. 저장 스키마 v2와 기존 v1 이전 경로는 유지했습니다.

Phaser가 프레임마다 좌표를 관리하고 공통 규칙 엔진을 호출합니다. Zustand는 상태 변화가 있을 때, 전투 중 최대 초당 5회 스냅샷을 UI로 전달합니다. 좌표는 React에 저장하지 않습니다. 탭 비활성화·재접속의 경과 시간을 보상으로 환산하지 않으며, 사냥은 재접속 시 OFF입니다.

미니 창은 **설정 → 미니 펫 창 · PiP → 미니 창 열기**에서 엽니다. HTTPS/localhost의 최상위 문서와 Document PiP API 지원이 필요합니다. 같은 React 루트·Phaser 캔버스를 이동하고 PiP 문서의 프레임 콜백으로 진행하므로 게임·세션 잠금을 두 번 시작하지 않습니다. 창의 크기와 위치는 브라우저가 결정하며 420×600은 요청 크기입니다. 보이는 PiP 창이 있으면 본 탭이 숨겨져도 진행하고, 현재 플레이 문서도 숨겨지면 멈춥니다. 본 탭 종료·브라우저 절전 이후의 경과 보상은 없습니다.

```sh
MOCHI_E2E_PRODUCTION=1 pnpm test:e2e apps/web/tests/mini-window.spec.ts
```

PiP 검사는 PC Chromium의 실제 API로 입력·크기 변경·원래 캔버스 복귀를 확인하고, 모바일에서는 native PiP 사례를 건너뜁니다. 미지원·열기 거부 처리는 PC/모바일 크기에서 별도로 검사합니다. 자동화 환경에서 본 탭의 `document.hidden`이 계속 false인 경우가 있어, 숨겨진 본 탭/보이는 PiP의 분기는 `phaserSurface.test.ts`에서 별도로 검사합니다. 다른 OS의 최상단 표시·실제 모바일·장시간 절전은 추가 검증이 필요합니다.

브라우저 저장 키는 `mochipet.web.v1`, `.previous`, `.damaged`, `.before-reset`입니다. 웹 테스트는 격리된 임시 브라우저 컨텍스트를 사용합니다. 실제 플레이 기록은 저장소 파일로 만들지 않습니다. 초기화는 사용자 확인 후 원본 백업 기록을 먼저 쓴 다음 진행합니다. 저장 공간 부족·브라우저 데이터 삭제·전원 손실까지 완전한 보관을 보장하지 않습니다.

집 안 기능은 같은 저장 키에서 `schema: 2`를 사용합니다. v1은 원래 필드를 엄격하게 검증한 뒤 청결 80·화장실 욕구 20·방 상태 85·빈 활동 횟수를 추가합니다. 첫 v2 저장 전에 `mochipet.web.v1.before-home-upgrade`에 v1 원본을 기록하고 재확인하며, 백업 실패 시 원본을 덮어쓰지 않습니다. 이후 자동 저장으로도 이 이전 원본은 교체하지 않습니다. 내보내기에 이 백업을 포함하고, 미래 버전은 계속 읽기 전용으로 보호합니다.

집·마당·사냥터 위치와 진행 중 활동·이동 좌표는 저장하지 않습니다. 재접속은 마당·사냥 OFF·활동 없음으로 시작합니다. 활동 효과·횟수는 가구 도착 후 제한된 프레임 시간으로만 누적하며 완료 시 저장합니다. 탭 숨김·새로고침 시간을 보상으로 환산하지 않습니다.

이번 웹 작업의 결과는 [변경 보고서](WEB_PHASE1.md), 다음 서버 단계는 [백엔드 계획](WEB_BACKEND_PLAN.md)에 있습니다.

---

# 개발·검사·빌드 안내

## 도구

기존 소스의 목표 버전은 **Godot 4.7.2 Standard (GDScript)**입니다. 이 정리 작업에서는 버전을 변경하지 않았습니다.
공식 버전 안내: https://godotengine.org/download/archive/4.7.2-stable/

Windows 설치판 빌드는 같은 버전의 export templates, NSIS 3.x, Python 3가 추가로 필요합니다.
Python은 개발용 정적 검사에만 사용합니다. .NET/C# 프로젝트는 아닙니다.
도구를 자동 다운로드하거나 실행 정책·보안 설정을 바꾸는 스크립트는 새로 추가하지 않았습니다.

## 코드만 검사

소스 폴더에서 실행합니다. Windows는 `python3` 대신 `py -3` 또는 설치된 `python`을 사용하세요.

```sh
python3 tests/static_audit.py
python3 -m unittest discover -s tests -p 'test_repository.py' -v
```

이 두 검사는 게임을 실행하지 않습니다. GDScript의 문법·타입 검사나 악성코드 검사도 아닙니다.
기존 `static_audit.py`는 전체 소스 트리에서 EXE 등의 존재도 검사하므로, 빌드 결과물이 남은 폴더에서는 실패할 수 있습니다. 처음 받은 깨끗한 소스에서 실행하거나 이전 결과물을 소스 밖으로 옮기세요.

## Godot로 실행 — 이번 작업에서 미검증

Godot Project Manager에서 Import → `project.godot` 선택 → 가져오기 완료 → 에디터 오류 확인 → F5 순서입니다.
초기 설정은 일반 창입니다. `mochi/experimental_desktop_overlay`는 `false`로 유지하세요.

아래의 `godot`은 개발자가 설치한 실제 Godot 실행 파일 명령으로 대체해야 합니다. 처음에는 이미지 가져오기가 필요합니다.

```sh
godot --version
godot --headless --path . --editor --import --quit
godot --headless --path . --check-only --script res://scripts/main.gd
godot --headless --path . --script res://tests/test_save_store.gd
godot --headless --path . --script res://tests/test_resources.gd
```

공식 명령 안내: https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html

저장 테스트는 `user://qa-save-프로세스ID/`에 별도 시험 기록을 만듭니다. 중단되면 시험 폴더가 남을 수 있습니다.
본 게임 저장폴더 전체를 지워 정리하지 마세요.

## Windows 설치판 제작 — 개발자용, 아직 미검증

`packaging/build_windows.ps1`과 `packaging/installer.nsi`는 기존 v0.4.1 소스 그대로입니다.
이 스크립트는 로컬에 준비된 도구만 사용하며, `-AcknowledgedUnreviewedBuild` 확인이 있어야 진행하도록 작성되어 있습니다.

```powershell
.\packaging\build_windows.ps1 `
  -GodotExe 'C:\BuildTools\Godot\Godot_v4.7.2-stable_win64_console.exe' `
  -MakeNsisExe 'C:\Program Files (x86)\NSIS\makensis.exe' `
  -PythonExe 'C:\BuildTools\Python\python.exe' `
  -GodotCopyrightFile 'C:\BuildTools\Godot\COPYRIGHT.txt' `
  -AcknowledgedUnreviewedBuild
```

위 경로는 예시이며 실제 도구 경로로 바꿉니다. 보안 설정/PowerShell 실행 정책을 무조건 해제하는 명령은 안내하지 않습니다.
생성 위치는 `build/`이며 Git에서 제외됩니다. 출력이 생성되어도 **서명 없는 검토판**이지 검증 완료본은 아닙니다.
이 저장소에는 서명키나 인증서가 없고, Mac용 export preset·설치기·공증 자동화도 아직 없습니다.

## 배포 전 수동 확인

[기존 출시 조건](검사결과_및_출시조건.md)을 기준으로 파싱·저장 복구·일반 계정 설치/삭제·실제 전투·재실행·초기화·절전·최소화·배율·다중 화면·파일/네트워크 변경·백신·장시간 자원 사용을 검증합니다.
검사 명령, 도구 버전, 날짜, 종료 코드와 실패 내용이 있어야 “통과”로 기록합니다.

## Git에서 유지할 것

공식 Godot 안내에 따라 `.godot/` 캐시를 제외하고 `.uid`와 원본 이미지의 `.import` 보조 파일은 관리합니다.
지금 묶음에는 Godot 실행으로 생성된 `.uid`/`.import`가 없습니다. 처음 에디터로 열어서 생성되면 변경 내용을 확인한 뒤 커밋하세요.
`export_presets.cfg`는 현재 서명 정보 없이 포함했습니다. 앞으로 키를 넣지 말고 자격 증명을 분리하세요.

- https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html
- https://godotengine.org/article/uid-changes-coming-to-godot-4-4/
