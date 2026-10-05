; Установщик КаркасКальк (NSIS). Собирается командой: node build/make-installer.js
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"

!define APPNAME "КаркасКальк"
!define EXE "KarkasCalc.exe"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\KarkasCalc"

Name "${APPNAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\KarkasCalc"
InstallDirRegKey HKCU "Software\KarkasCalc" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1049 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1049 "FileDescription" "Установка ${APPNAME}"
VIAddVersionKey /LANG=1049 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1049 "CompanyName" "Пермяков Сергей"
VIAddVersionKey /LANG=1049 "LegalCopyright" "© 2026"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Установка ${APPNAME} ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Калькулятор стоимости каркасного дома.$\r$\n$\r$\nПрограмма считает смету по вашему прайсу (таблица Excel): фундамент, каркас, утепление, кровлю, фасад, окна, отделку и инженерию.$\r$\n$\r$\nНажмите «Далее», чтобы продолжить."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Запустить ${APPNAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"

Section "Install"
  ; закрываем запущенную копию, чтобы файлы можно было перезаписать
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  SetOutPath "$INSTDIR"
  File /r "${SRCDIR}\*.*"
  File "icon.ico"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Удалить ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\KarkasCalc" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${REGKEY}" "Publisher" "Пермяков Сергей"
  WriteRegStr HKCU "${REGKEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${REGKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${REGKEY}"
  DeleteRegKey HKCU "Software\KarkasCalc"
  ; прайс и сохранённые расчёты в %APPDATA%\karkas-calc не удаляем — они пригодятся при переустановке
SectionEnd
