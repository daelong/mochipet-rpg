# 변경 작업 안내

개발 전 [현재 상태](docs/PROJECT_STATUS.md)와 [개발 안내](docs/DEVELOPMENT.md)를 읽으세요.
작은 변경 단위로 브랜치를 사용하고, 게임 로직과 플랫폼 창·설치 기능 변경을 가능하면 분리합니다.

커밋 예시: `fix: preserve save backup on write failure`, `feat: implement rabbit base skill`, `docs: clarify desktop overlay status`.
문서 예시를 실제 구현 완료로 착각하지 않도록 테스트 결과를 적습니다.

변경 전후 실행할 기본 검사:

```sh
python3 tests/static_audit.py
python3 -m unittest discover -s tests -p 'test_repository.py' -v
```

Godot 검사를 못 했다면 “미실행”이라고 명시합니다. 창 동작은 Windows/macOS 각각의 실기기 결과가 필요합니다.
원본 런타임 코드의 들여쓰기는 공백 4칸입니다. 대량 포맷 변경과 기능 변경을 한 커밋에 섞지 않습니다.
리소스 경로와 UID를 함께 관리하고 캐시·저장파일·인증서를 업로드하지 않습니다.
공개 기여 수락·라이선스 정책은 저장소 소유자가 결정해야 합니다.
