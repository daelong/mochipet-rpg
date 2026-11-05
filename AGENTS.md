# 모찌펫 프로젝트 작업 규칙

## 기준

- Godot 4.7.2 Standard + GDScript, v0.4.1-review를 기준으로 한다.
- 먼저 README.md, docs/PROJECT_STATUS.md, docs/DEVELOPMENT.md를 읽는다.
- 보존된 Godot 런타임은 scripts/*.gd, scenes/, assets/다. 사용자 요청으로 추가한 웹 런타임은 apps/web, packages/shared, packages/game-data다. tests의 Python은 개발 도구다.
- 웹 작업은 docs/WEB_PHASE1.md도 읽고 pnpm test, pnpm build와 해당 브라우저 검사를 수행한다. 웹 데이터 변경 시 pnpm catalogs로 docs/catalogs/web-*.csv도 갱신한다.
- 이 저장소는 보안 인증본/실행 검증 완료본이 아니다. 미실행 검사를 통과라고 보고하지 않는다.

## 유지할 조건

- 오프라인 최대 레벨 20. 온라인은 구현 전이며 로컬 기록을 신뢰하는 임시 서버를 만들지 않는다.
- 사용자 요청 없이 언어를 바꾸거나 Python/Go/JXA 병렬 버전을 다시 만들지 않는다.
- 일반 창 기본을 유지한다. 운영체제별 검증 없이 experimental_desktop_overlay를 켜지 않는다.
- 저장 스키마·백업·초기화 확인·중복 실행 가드를 무심코 제거하지 않는다.
- 관리자 권한 강요, 보안 설정 변경, 백신 예외 추가, 임의 원격 코드 실행을 넣지 않는다.
- 토큰/개인키/저장기록/스크린샷 개인정보/실행 바이너리는 커밋하지 않는다.
- 기존 assets 경로를 바꾸면 모든 참조와 테스트를 수정한다. *.uid와 *.import는 무시하지 않는다.
- 캐릭터·사냥터·상점 상수 변경 시 docs/catalogs의 읽기용 CSV도 갱신한다.

## 검증

```sh
python3 tests/static_audit.py
python3 -m unittest discover -s tests -p 'test_repository.py' -v
```

Godot가 준비된 환경에서는 docs/DEVELOPMENT.md의 가져오기·파싱·저장·리소스 테스트도 수행한다.
정적 검사 통과를 게임 실행·바이러스 검사·안전 인증으로 표현하지 않는다.
구현한 것 / 실행한 검사 / 실행하지 못한 검사 / 알려진 문제를 변경 보고서에서 구분한다.

## 공개와 배포

공개 라이선스는 소유자가 아직 선택하지 않았다. MIT 등의 LICENSE를 임의로 추가하지 않는다.
EXE가 실제로 생성되지 않았으면 실행판 다운로드가 있다고 쓰지 않는다.
GitHub Actions를 추가할 경우 권한, 외부 Action 출처/버전, 비밀값 사용, 비용과 실행 범위를 먼저 검토한다.
