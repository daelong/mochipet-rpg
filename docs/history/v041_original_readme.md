# 모찌펫 RPG 0.4.1 — 보안·안정성 보완 소스 검토본

**이 ZIP은 Godot 프로젝트와 설치판 제작 소스입니다. 완성 EXE, 설치 프로그램 또는 보안 인증본이 아닙니다.**
기존 v0.4 Windows 설치 파일을 실행할 필요는 없습니다. 이 소스의 변경은 기존 EXE를 자동으로 고치지 않습니다.

## 현재 상태

- 기존 Godot v0.4 프로젝트를 기준으로 소스를 수정했습니다.
- Python으로 실행한 32개 정적 정책/패키지 확인 항목과 PNG 400개 구조 검사를 통과했습니다.
- 이 정적 검사는 코드에 특정 보호 장치가 있는지 및 파일 구성이 맞는지 확인하는 검사입니다. GDScript 실행이나 보안 감사가 아닙니다.
- 현재 작업 환경에는 Godot 실행기, Windows 테스트 환경, NSIS가 없어 **GDScript 파싱·런타임 검사, EXE 내보내기, 설치/제거, 백신 검사, 바탕화면 창 동작은 실행 검증하지 못했습니다.**
- `tests/test_save_store.gd`와 `tests/test_resources.gd`는 개발 환경에서 실행해야 할 테스트이며 여기에서 통과했다고 주장하지 않습니다.
- 코드 서명·SmartScreen 평판은 별도입니다. 이 소스만으로 경고가 없어지지 않습니다.

## 바뀐 점

### 설치 / 보안

기존 Go 기반 다운로드 설치기는 수정 EXE로 다시 제공하지 않습니다. 대체하는 `packaging/installer.nsi`는 **이미 내보낸 Godot 실행 파일과 리소스를 전부 포함하는 오프라인 설치 방식**입니다.

- 일반 사용자 권한만 요청 (`RequestExecutionLevel user`).
- 사용자 `LocalAppData\Programs`에 검토판을 별도로 설치하도록 정의.
- 설치 중 추가 다운로드, 자동 업데이트, 시스템 시작 자동 실행 등록 없음.
- Windows 보안 설정·백신 예외·방화벽·브라우저 설정 변경 없음.
- 시작 메뉴 바로가기와 현재 사용자의 표준 제거 정보(HKCU)는 생성함.
- 설치 직후 실행은 기본 선택 해제. 사용자 확인 없는 실행 없음.
- 제거는 포함한 파일 이름 목록만 사용. 저장 데이터나 폴더 전체를 재귀 삭제하지 않음.
- 게임 GDScript에는 네트워크·외부 프로세스 실행·화면 캡처·키보드 전역 후크 호출을 넣지 않음.
- 이는 코드 설계 범위입니다. 엔진 전체의 취약점 부재나 실제 통신 부재를 증명한 것은 아닙니다.

### 저장 / 초기화

- 앱 전용 새 저장 폴더 사용. 이전 버전 데이터에 자동 접근하거나 덮어쓰지 않음.
- JSON 파일 크기 64 KiB, 캐릭터 ID 목록, 자료형, 숫자 범위, 문자열 길이 검사.
- 새 기록은 임시 파일에 쓰고 다시 읽어 확인한 뒤 교체. 이전 정상 기록 백업 유지.
- 손상 시 이전 정상 기록을 우선 사용. 복구할 수 없으면 자동 저장 중단.
- 더 높은 저장 형식 버전을 발견하면 덮어쓰기와 초기화 중단.
- 초기화는 확인창 후 실행. 직전 기록을 `before-reset.json`에 **마지막 1개만** 보관.
- 저장은 약 10초 단위로 묶어 처리하며 종료 때 추가 저장. 충돌 시 최근 진행 일부를 잃을 수 있음.
- 디렉터리 잠금으로 다중 실행의 저장 충돌을 줄임. 잠금 확인에 실패하면 실행 중단.
- 갑작스러운 전원 손실, 디스크 고장, 저장장치 오류까지 완전히 방지하는 기능은 아님.

### 화면 / 자원 사용

- 첫 시작은 제목 표시줄과 닫기 버튼이 있는 일반 창. 항상 위/투명/테두리 없음은 기본 해제.
- 기존 화면 전체 클릭 영역 계산은 제거. **바탕화면 자유 이동 모드는 Windows/macOS 검증 전까지 기본 비활성화**.
- 사냥·상점·28종 캐릭터·레벨 20 제한은 일반 창에서 유지하는 소스 구조.
- 바탕화면 모드 대체 코드는 별도 제어 창 방식으로 분리했으나 아직 운영체제에서 검증하지 않음. 일반 사용자가 활성화하면 안 됨.
- 활성 프레임 30 FPS, 일시정지/최소화 10 FPS; 전투 진행도 멈춤.
- 표시 이펙트 최대 24개, 동시에 몬스터 1개. 실제 발열·CPU·배터리 수치는 측정하지 못함.
- 무제한 오류 로그의 디스크 사용을 피하도록 일반 게임의 파일 로깅은 기본 해제.

## 폴더

- `project.godot`, `scenes/`, `scripts/`, `assets/`: 수정한 공통 Godot 프로젝트
- `tests/static_audit.py`: Python 표준 라이브러리만 쓰는 정적 검사
- `tests/test_save_store.gd`: 저장/복구/검증 테스트 (이 세션에서는 미실행)
- `tests/test_resources.gd`: Godot의 이미지 읽기 검사 (이 세션에서는 미실행)
- `packaging/build_windows.ps1`: 개발자용 로컬 빌드 절차. 자체 다운로드 없음
- `packaging/installer.nsi`: 오프라인 Windows 설치/제거 소스
- `docs/검사결과_및_출시조건.md`: 수행한 검사와 남은 조건
- `docs/변경내역.patch`: 원본과의 코드 차이
- `docs/static_results.json`: 실제 정적 검사 결과
- `docs/original_input_facts.json`: 점검한 원본의 해시/PE 서명 테이블 확인

## 개발자 실행 및 설치판 빌드

목표 버전은 **Godot 4.7.2 Standard + GDScript**입니다. 사용자가 Python이나 Godot을 설치해야 하는 완성 배포 방식은 아닙니다. 아래 도구는 **개발용 빌드 컴퓨터**에서만 필요합니다.

1. 공식 출처에서 받은 Godot 4.7.2 Standard와 같은 버전의 내보내기 템플릿, NSIS 3.x, Python 3를 개발 환경에 준비합니다. 현재 환경에서는 이 준비/빌드를 하지 못했습니다.
2. Godot에서 `project.godot`을 가져온 후 파싱 오류부터 확인합니다.
3. 프로젝트 폴더에서 아래 검사들을 실행하고 오류가 하나라도 있으면 배포하지 않습니다.

```text
python tests/static_audit.py
godot --headless --path . --check-only --script res://scripts/main.gd
godot --headless --path . --script res://tests/test_save_store.gd
godot --headless --path . --script res://tests/test_resources.gd
```

4. Windows 개발 환경의 PowerShell에서 로컬 도구 경로와 해당 Godot 버전의 전체 `COPYRIGHT.txt`를 지정하여 `packaging/build_windows.ps1`을 실행합니다. 이 스크립트는 테스트 실패 시 설치판 생성을 중단하도록 작성했습니다. 스크립트 실행 정책을 우회하거나 일반 사용자에게 PowerShell 명령 실행을 시키는 배포 방식이 아닙니다.
5. 결과가 생성되더라도 `Review` 표기의 **서명 없는 검토용 설치판**입니다. 깨끗한 Windows 테스트 환경에서 검증 후 정식 배포 절차로 진행해야 합니다.

예시 (경로는 개발자가 준비한 실제 경로로 대체):

```powershell
.\packaging\build_windows.ps1 `
  -GodotExe 'C:\BuildTools\Godot\Godot_v4.7.2-stable_win64_console.exe' `
  -MakeNsisExe 'C:\Program Files (x86)\NSIS\makensis.exe' `
  -PythonExe 'C:\BuildTools\Python\python.exe' `
  -GodotCopyrightFile 'C:\BuildTools\Godot\COPYRIGHT.txt' `
  -AcknowledgedUnreviewedBuild
```

## 저장 경로 (이 소스로 빌드한 앱)

Windows: `%APPDATA%\MochiPetRPG\desktop-v041\`

macOS: `~/Library/Application Support/MochiPetRPG/desktop-v041/`

`save.json` 현재 기록, `save.previous.json` 이전 정상 기록, `save.pending.json` 교체 대기 기록, `before-reset.json` 마지막 초기화 전 백업입니다.
기존 v0.4 기록을 자동으로 가져오지 않습니다. 현재 사용자는 아직 실행하지 않았으므로 이전 기록을 옮길 필요가 없습니다.

`session.lock`에 유효한 소유자 기록이 없으면 자동으로 삭제하지 않고 실행을 중단합니다. 모든 모찌펫 프로세스가 종료됐는지 확인한 뒤 **앱 전용 폴더의 해당 잠금 디렉터리만** 개발자가 확인하여 처리해야 합니다.

## 사용 범위

온라인 계정, 멀티플레이, 서버 검증, 부정행위 방지는 이 작업 범위가 아닙니다. 오프라인 코인·레벨 기록을 신뢰 가능한 서버 자산으로 그대로 가져가면 안 됩니다. 향후 온라인 연동 설계를 따로 검토해야 합니다.
이 검토본은 일반 사용자 대상 출시 자료가 아닙니다. 원본 캐릭터 이미지와 애니메이션은 변경하지 않았습니다. 소재의 권리 검토나 제3자 보안 감사도 수행하지 않았습니다.
