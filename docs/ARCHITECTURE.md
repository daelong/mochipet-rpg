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
