; Development-review installer source. NOT a signed or tested release artifact.
; Requires trusted, locally installed NSIS 3.x and an already exported game.
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!ifndef PAYLOAD_DIR
  !error "PAYLOAD_DIR is required. Export the game locally first."
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE is required."
!endif
!define APP_NAME "MochiPet RPG Review 0.4.1"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MochiPetRPG-Review-041"

Name "${APP_NAME}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\MochiPetRPG-Review\0.4.1"
RequestExecutionLevel user
ManifestDPIAware true
ManifestSupportedOS all
CRCCheck force
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "모찌펫 RPG 검토용 빌드"
!define MUI_WELCOMEPAGE_TEXT "서명되지 않은 개발용 테스트판입니다.$\r$\n$\r$\n설치 중 인터넷 다운로드, 관리자 권한 요청, 자동 실행 등록, 백신 설정 변경을 하지 않습니다.$\r$\n$\r$\nWindows 실행·보안 검증을 마친 정식 배포본은 아닙니다. 설치를 취소해도 됩니다."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\MochiPetRPG.exe"
!define MUI_FINISHPAGE_RUN_TEXT "모찌펫 실행 (선택)"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Function .onInit
  SetShellVarContext current
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "이 빌드는 Windows 64비트용입니다."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "Windows 10 이상에서만 설치하도록 설정했습니다."
    Abort
  ${EndIf}
  ; No command-line directory override. No elevated install context.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\MochiPetRPG-Review\0.4.1"
  IfFileExists "$INSTDIR\MochiPetRPG.exe" 0 +3
    MessageBox MB_ICONSTOP "같은 검토판이 이미 있습니다. 앱을 닫고 기존 검토판을 제거한 뒤 다시 설치하세요. 저장 기록은 유지됩니다."
    Abort
FunctionEnd

Section "Game"
  SetShellVarContext current
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\MochiPetRPG-Review\0.4.1"
  ; Refuse junction/reparse-point redirection of the app's own directories.
  System::Call 'kernel32::GetFileAttributesW(w "$LOCALAPPDATA\Programs\MochiPetRPG-Review") i .r0'
  IntOp $1 $0 & 0x400
  ${If} $0 != -1
  ${AndIf} $1 != 0
    MessageBox MB_ICONSTOP "설치 폴더가 링크로 연결되어 있어 설치를 중단했습니다."
    Abort
  ${EndIf}
  System::Call 'kernel32::GetFileAttributesW(w "$INSTDIR") i .r0'
  IntOp $1 $0 & 0x400
  ${If} $0 != -1
  ${AndIf} $1 != 0
    MessageBox MB_ICONSTOP "설치 경로가 링크로 연결되어 있어 설치를 중단했습니다."
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  ClearErrors
  File "${PAYLOAD_DIR}\MochiPetRPG.exe"
  File "${PAYLOAD_DIR}\MochiPetRPG.pck"
  File "${PAYLOAD_DIR}\BUILD_INFO.txt"
  File "${PAYLOAD_DIR}\GODOT_COPYRIGHT.txt"
  File "${PAYLOAD_DIR}\PAYLOAD_SHA256.txt"
  IfErrors 0 files_ok
    MessageBox MB_ICONSTOP "파일 복사에 실패했습니다. 자동 실행하지 않습니다. 설치 폴더를 확인해 주세요."
    Abort
  files_ok:
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  IfErrors 0 uninstaller_ok
    MessageBox MB_ICONSTOP "제거 프로그램 생성에 실패했습니다. 설치를 중단합니다."
    Abort
  uninstaller_ok:
  CreateDirectory "$SMPROGRAMS\MochiPet RPG Review"
  CreateShortcut "$SMPROGRAMS\MochiPet RPG Review\MochiPet RPG.lnk" "$INSTDIR\MochiPetRPG.exe"
  CreateShortcut "$SMPROGRAMS\MochiPet RPG Review\제거.lnk" "$INSTDIR\Uninstall.exe"
  ; Only standard per-user uninstall metadata is written. No Run/Startup keys.
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "0.4.1-review"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$"$INSTDIR\Uninstall.exe$"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ; A strict list only. No RMDir /r, user-data deletion or system-folder cleanup.
  ClearErrors
  Delete "$INSTDIR\MochiPetRPG.exe"
  IfErrors 0 +3
    MessageBox MB_ICONSTOP "실행 파일을 제거할 수 없습니다. 모찌펫을 닫고 다시 시도하세요."
    Abort
  Delete "$INSTDIR\MochiPetRPG.pck"
  Delete "$INSTDIR\BUILD_INFO.txt"
  Delete "$INSTDIR\GODOT_COPYRIGHT.txt"
  Delete "$INSTDIR\PAYLOAD_SHA256.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\MochiPet RPG Review\MochiPet RPG.lnk"
  Delete "$SMPROGRAMS\MochiPet RPG Review\제거.lnk"
  RMDir "$SMPROGRAMS\MochiPet RPG Review"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  MessageBox MB_OK "프로그램 제거를 요청했습니다. 실행 중인 파일은 남을 수 있습니다.$\r$\n앱 전용 폴더의 육성 저장 기록은 삭제하지 않았습니다."
SectionEnd
