# GitHub에 처음 올리기

이 파일 묶음은 **업로드 준비 자료**입니다. 저장소를 생성하거나 계정에 업로드한 상태가 아닙니다.
추천 저장소 이름은 `mochipet-rpg`, 초기 공개 범위는 **Private**입니다.

## 가장 쉬운 방법: GitHub Desktop

1. GitHub Desktop을 설치하고 본인 계정으로 로그인합니다.
2. `File → New repository`에서 이름을 `mochipet-rpg`로 설정합니다. 저장할 부모 폴더를 선택합니다. 이미 압축을 푼 폴더와 다른 위치에 만들면 혼동이 적습니다.
3. Git ignore와 License 선택은 `None`으로 둡니다. README 초기화는 선택하지 않아도 됩니다. 새 로컬 저장소를 만듭니다.
4. 내려받은 ZIP을 풀고 **그 안의 `mochipet-rpg` 폴더 내용 전체**를 새 로컬 저장소 폴더 안에 복사합니다. `project.godot`과 `README.md`가 저장소 바로 아래에 있어야 합니다. `mochipet-rpg/mochipet-rpg/project.godot`처럼 이중으로 넣지 않습니다.
5. `.gitignore`, `.gitattributes`, `.editorconfig`, `.github`도 복사해야 합니다. 숨김 파일이 보이지 않으면 운영체제의 숨김 파일 표시를 켭니다. Desktop이 만든 `.git` 폴더는 지우거나 덮어쓰지 않습니다. 겹치는 `.gitattributes`는 이 묶음의 것으로 대체합니다.
6. Desktop의 Changes에서 이미지·소스가 보이고 EXE·ZIP·저장파일·인증키가 없는지 확인합니다. 요약에 `chore: import MochiPet Godot v0.4.1 review source`를 입력하고 현재 브랜치에 Commit합니다.
7. `Publish repository`를 누르고 **Keep this code private를 체크한 상태**로 게시합니다. 게시될 계정과 저장소 이름을 마지막으로 확인합니다.
8. `View on GitHub`로 열어 루트 README와 `project.godot`, `scripts`, `assets`가 보이는지 확인합니다. 최상위에 ZIP 한 개만 보이면 소스 업로드가 아니라 압축파일만 올린 것입니다.

공식 절차:
- https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop
- https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop

## Git 명령을 쓰는 경우

먼저 GitHub에서 **비어 있는 Private 저장소**를 생성합니다. 서버 쪽에서는 README·gitignore·License 초기화를 선택하지 않습니다.
그 뒤 압축을 푼 `mochipet-rpg` 디렉터리에서 아래 명령을 직접 실행합니다. `YOUR_ACCOUNT`는 본인 계정으로 바꿉니다.
기존 `.git`이 있는 저장소에서는 이 초기화 절차 대신 기존 원격·브랜치를 먼저 확인하세요.

```sh
git init -b main
git status --short
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "chore: import MochiPet Godot v0.4.1 review source"
git remote add origin https://github.com/YOUR_ACCOUNT/mochipet-rpg.git
git push -u origin main
```

`git commit`이 이름·이메일을 요청하면 본인의 설정을 사용합니다. 타인의 정보나 예시 이름으로 커밋하지 마세요.
로그인은 GitHub Desktop 또는 Git의 인증 안내를 사용하고, 액세스 토큰을 파일·명령 예시·커밋 메시지에 붙여 넣지 않습니다.

공식 절차: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github

## 웹브라우저 업로드는 이 프로젝트에서는 비추천

이 묶음은 PNG만 400개입니다. GitHub 웹 업로드는 한 번에 최대 100개 파일을 처리하고 `.gitattributes` 변환도 적용하지 않으므로 Desktop이나 Git으로 올리는 쪽을 권합니다.
웹 업로드 화면에 직접 넣을 때는 `.gitignore`가 파일을 자동으로 골라 주는 안전장치라고 생각하면 안 됩니다. 올리는 파일을 직접 확인해야 합니다.

공식 제한: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

## 이후 수정할 때

변경 목적마다 브랜치를 만들어 작업하고, 테스트 결과와 미실행 항목을 함께 기록합니다.
GitHub Desktop에서 변경 파일 확인 → Commit → Push 순서로 반영합니다.
정상 동작을 검증한 실제 실행판이 생기면 소스 루트에 섞지 않고 별도 릴리스 자산으로 배포하는 구조를 사용하세요.
아직 실행판이 없으므로 출시 완료를 의미하는 릴리스나 다운로드 버튼은 만들지 않습니다.

## 올리지 않을 것

기존 EXE·Mac 설치 앱·옛 ZIP, `.godot/`, `build/`, 개인 플레이 저장기록, 실행 로그, 보안 인증서·개인키, API 토큰, 사용자 이름이 나온 스크린샷은 제외합니다.
기존 버전은 개인 백업으로 별도 보관하면 됩니다. 이 저장소는 최신 Godot 코드를 기준으로 이어 갑니다.
`.gitignore`는 이미 추적 중인 파일을 지워 주지 않으며, 비밀값이 유출된 경우 파일 삭제만으로 해결되지 않습니다. 공개 전에 커밋 목록을 검토하세요.
