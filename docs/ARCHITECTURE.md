# 웹 MVP 구조와 상태 흐름

```text
apps/web/src/App.tsx                 화면·메뉴·구매·캐릭터 선택
  state/game.ts                     세션 잠금·Zustand·자동 저장
  state/storage.ts                  스키마 검증·백업·복구·초기화
  game/GameCanvas.tsx               React/Phaser 생명주기 연결
  game/MeadowScene.ts                좌표·이동·애니메이션·거리 판정·효과
packages/shared/src/index.ts         순수 게임 규칙·Pet 검증·서버 확장 계약
packages/game-data/src/index.ts      캐릭터·스킬·몬스터·사냥터·상점
```

UI 명령은 규칙 엔진에 전달됩니다. Phaser는 좌표를 보유하고 30 FPS 목표로 이동을 계산하며, 근접 여부만 규칙 엔진에 전달합니다. 규칙 엔진은 쿨다운·피해·보상·성장·한도를 계산하고, Zustand가 결과 스냅샷을 React에 전달합니다. React는 매 프레임 좌표 갱신을 하지 않습니다. 화면에 없을 때는 게임 규칙 진행을 멈춥니다.

현재 캐릭터의 동작 프레임과 몬스터 텍스처를 로딩하고, 선택 화면 이미지는 지연 로딩합니다. 동시에 몬스터는 1마리, 이벤트 기록은 최근 12개, 떠오르는 텍스트는 최대 16개입니다. Phaser는 초기 화면 코드와 분리해 동적 로딩합니다. 기존 PNG 400개는 원본 위치를 보존하고 Vite 플러그인이 개발 중 제공하거나 빌드의 `game-assets/`로 복사합니다.

저장 서비스는 Web Locks 소유 세션에서만 쓰기를 허용합니다. 사냥·몬스터·위치·쿨다운은 저장하지 않으므로 접속 시 새로 시작합니다. 미래 저장 스키마·복구 불가 기록은 자동 덮어쓰지 않습니다. 초기화 전 백업과 외부 파일 내보내기를 제공합니다. 가져오기는 아직 없습니다.

`GameCommand`/`ServerGamePort`는 향후 서버 접점의 타입이며 실행 중인 API는 없습니다. 로컬 상태는 향후 서버가 신뢰할 증거가 아닙니다. 자세한 내용은 [서버 계획](WEB_BACKEND_PLAN.md)을 참고하세요.

아래는 보존된 Godot 소스의 구조입니다. 웹과 저장 파일·런타임을 공유하지 않습니다.

---

# 구조와 코드 지도

## 현재 구조

```text
project.godot
  └─ scenes/Main.tscn
       └─ scripts/main.gd
            ├─ scripts/save_store.gd
            ├─ scripts/session_guard.gd
            └─ assets/{pets,monsters}/...png
```

| 파일 | 담당 |
|---|---|
| `project.godot` | 시작 씬, 일반 창 크기, GL Compatibility, 앱 전용 저장 폴더, 오버레이 기능 플래그 |
| `scenes/Main.tscn` | `main.gd`를 연결하는 루트 Node2D |
| `scripts/main.gd` | UI 생성, 캐릭터/지역 상수, 상점, 산책·전투·그리기, 저장 요청, 창 모드 |
| `scripts/save_store.gd` | 저장 기본값, ID 목록, 자료형/범위 검사, 기록 교체·복구·초기화 백업 |
| `scripts/session_guard.gd` | 앱 전용 디렉터리 잠금과 프로세스 확인으로 중복 실행 차단 |
| `tests/static_audit.py` | 문자열·구성 정책과 PNG 청크 검사. 컴파일/백신 아님 |
| `tests/test_repository.py` | 저장소 경로·메타데이터·문서 링크·금지 파일명 확인 |
| `tests/test_save_store.gd` | Godot에서 실행할 저장·복구·입력 검증 테스트 |
| `tests/test_resources.gd` | Godot에서 실행할 400개 텍스처 로딩 테스트 |
| `packaging/build_windows.ps1` | 로컬 도구 검사 → 테스트 → Windows 내보내기 → NSIS 빌드 |
| `packaging/installer.nsi` | 현재 사용자용 오프라인 설치·제거 정의 |

## 자료 구조와 저장

현재 밸런스 데이터는 `main.gd` 안에 있으며, `data` Dictionary가 펫 상태를 보유합니다.
`save_store.gd`의 `SCHEMA = 1`이 저장 형식 버전입니다. 기존 사용자 기록을 임의로 덮어쓰거나 자동 초기화하지 않습니다.

앱 설정상 저장 위치:
- Windows: `%APPDATA%/MochiPetRPG/desktop-v041/`
- macOS: `~/Library/Application Support/MochiPetRPG/desktop-v041/`

`save.json`은 현재 기록, `save.previous.json`은 이전 정상 기록, `before-reset.json`은 마지막 초기화 전 백업입니다.
이 경로의 파일은 소스 저장소에 넣지 않습니다. 저장 백업은 디스크 고장이나 갑작스러운 전원 손실까지 보장하는 기능이 아닙니다.

## 다음 리팩터링 후보 — 아직 파일 없음

`main.gd`의 UI·전투·상점·플랫폼 창 로직을 각각 분리하고, 캐릭터·스킬·사냥터 정보를 Godot Resource 또는 검증된 데이터 파일로 이전할 수 있습니다.
현재 동작을 테스트로 고정한 뒤 한 번에 한 영역씩 분리하세요. 빈 서버 코드나 가짜 계정 기능을 추가해 구현된 것처럼 보이게 하지 않습니다.
캐릭터 ID를 바꾸면 이미지 경로, 저장 화이트리스트, 씬과 테스트를 함께 수정해야 합니다.
