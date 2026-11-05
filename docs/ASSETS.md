# 이미지 리소스와 출처

이번 저장소의 이미지는 모두 대화에서 제공된 `MochiPet_Godot_v0.4.1_Security_Review_Source.zip`에서 가져왔습니다.
온라인에서 새 이미지를 내려받거나 그림을 추가 생성한 작업은 아닙니다.

| 디렉터리 | 내용 | 파일 수 |
|---|---|---:|
| `assets/pets/` | 28개 캐릭터 × 7개 상태 × 2프레임 | 392 |
| `assets/monsters/` | 몬스터 8종 | 8 |

상태 이름은 `idle`, `walk`, `play`, `eat`, `happy`, `sad`, `sleep`입니다.
파일명은 예를 들어 `assets/pets/z_rabbit/walk_0_right.png` 형식입니다.
7가지 상태 이미지가 존재한다는 것은 모든 행동 전환 시스템이 구현되어 있다는 뜻이 아닙니다.

이번 정리는 이미지 바이트를 바꾸지 않습니다. 기존 `docs/static_results.json`에는 이미지별 SHA-256이 있습니다.
대화 초기에 생성된 컨셉 이미지/선택표, 개인 스크린샷, 이전 실행판 전체는 현재 게임에 필요하지 않아 제외했습니다.
원본 제작/편집 과정의 권리 증빙까지 확인한 것은 아닙니다. 공식 배포 전 캐릭터 디자인·명칭·이미지 사용 범위를 검토해야 합니다.

캐릭터별 파일 경로와 기본 스킬명은 [characters.csv](catalogs/characters.csv)에 있습니다.
모든 PNG는 현재 크기 기준으로 일반 Git 파일로 관리하도록 구성했고 LFS 포인터로 변환하지 않았습니다.
대형 원화·영상·음원을 추가하기 전에는 Git LFS 정책을 별도로 정하세요.

공식 안내: https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html
