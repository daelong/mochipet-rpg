# 웹 Phase 1 · 0.1.0 · 2026-11-05

- React·Phaser·TypeScript 웹 MVP와 pnpm workspace, 공통 데이터·규칙·테스트 추가.
- 28종 선택, 자동 산책/전투, 28개 시작 스킬, 8종 몬스터·4개 사냥터, 레벨 20·상점 구현.
- 브라우저 저장 검증·복구·초기화 백업·중복 탭 잠금, PC/모바일 반응형 화면 추가.
- 기존 PNG 400개를 압축에서 원래 경로로 복원하고 Godot 로직과 설정 보존.
- 자세한 결과와 미검증 항목은 [웹 보고서](docs/WEB_PHASE1.md) 참고.

---

# 변경 기록

## 2026-11-05 · GitHub 보관용 정리

- 기준: `MochiPet_Godot_v0.4.1_Security_Review_Source.zip`.
- 프로젝트 버전은 `0.4.1-review` 유지. 게임 코드·씬·설정·이미지·기존 빌드 스크립트는 변경하지 않음.
- 최상위 README, 업로드·개발·구조·로드맵·상태 문서, 캐릭터/사냥터/상점 CSV 추가.
- `.gitignore` 보강, `.gitattributes`와 `.editorconfig` 추가.
- 개발 도우미 규칙, 보안·라이선스 미결정 안내, Issue/PR 템플릿 추가.
- 소스 보관용 테스트 추가. 기존 검사를 다시 실행한 결과는 `docs/REPOSITORY_REVIEW.md`에 기록.
- 예전 ZIP·EXE·Mac 설치기·개인 스크린샷은 포함하지 않음.
- 새 EXE 생성, 게임 실행 검증, GitHub 계정 업로드는 수행하지 않음.

## v0.4.1-review · 이전 보완 소스 기록

저장 검증·백업·중복 실행 가드·일반 창 시작·FPS 상한·오프라인 설치기 소스가 추가된 검토본.
당시 기록은 [기존 검사 결과](docs/검사결과_및_출시조건.md)와 [원본 README](docs/history/v041_original_readme.md)를 참조.

## v0.4 및 그 이전

이전 대화에서 Python, Windows 실행판, Mac JXA, 브라우저 모드, 초기 Godot 소스가 별도로 제공됨.
이 저장소에는 해당 실행판과 병렬 구현을 합치지 않았음. 현재 Godot 기준 프로젝트만 유지.
