; Migração do instalador antigo (Inno Setup, versões 1.0.x) para o novo com atualização automática.
; Os dois usam a mesma pasta (%LOCALAPPDATA%\Programs\Concord), então o antigo é removido antes.
!macro customInit
  IfFileExists "$LOCALAPPDATA\Programs\Concord\unins000.exe" 0 concord_no_legacy
    ; Fecha o app antigo se estiver aberto
    nsExec::Exec 'taskkill /IM Concord.exe /F'
    Sleep 1000
    ExecWait '"$LOCALAPPDATA\Programs\Concord\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART'
    ; O desinstalador do Inno roda uma cópia de si mesmo e retorna na hora: espera ele terminar (até ~20s)
    StrCpy $R9 0
    concord_wait_legacy:
      IfFileExists "$LOCALAPPDATA\Programs\Concord\unins000.exe" 0 concord_no_legacy
      IntOp $R9 $R9 + 1
      IntCmp $R9 40 concord_no_legacy
      Sleep 500
      Goto concord_wait_legacy
  concord_no_legacy:
!macroend
