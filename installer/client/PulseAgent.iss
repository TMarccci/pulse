; Pulse Agent installer (Inno Setup 6+)
; Build:  iscc /DAppVersion=1.2.3 PulseAgent.iss
; The published single-file exe is expected at ..\..\agent\PulseAgent\publish\PulseAgent.exe
;   (override with /DAgentExe=<path>)

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef AgentExe
  #define AgentExe "..\..\agent\PulseAgent\publish\PulseAgent.exe"
#endif
#ifndef IconFile
  #define IconFile "..\..\assets\pulse.ico"
#endif

#define AppName "Pulse Agent"
#define Publisher "Pulse"
#define AppId "{{7B2E9C4A-2E4D-4C77-9A2B-9E3A1F5D77A1}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#Publisher}
VersionInfoVersion={#AppVersion}

; Per-user install: no admin/UAC needed, ideal for a USB "walk-up" setup.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={localappdata}\Programs\Pulse Agent
DisableProgramGroupPage=yes
DisableReadyPage=no
DisableDirPage=yes
Uninstallable=yes
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\pulse.ico
SetupIconFile={#IconFile}
OutputDir=Output
OutputBaseFilename=PulseAgentSetup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#AgentExe}"; DestDir: "{app}"; DestName: "PulseAgent.exe"; Flags: ignoreversion
Source: "{#IconFile}"; DestDir: "{app}"; DestName: "pulse.ico"; Flags: ignoreversion

[Run]
; After install, launch the agent. On first run it shows the config window; if the
; device is already enrolled (silent update), it starts monitoring hidden.
Filename: "{app}\PulseAgent.exe"; Description: "Start {#AppName}"; Flags: nowait postinstall

[UninstallRun]
; Stop the running (windowless) agent, then remove autostart + local data.
Filename: "{sys}\taskkill.exe"; Parameters: "/IM PulseAgent.exe /F"; Flags: runhidden; RunOnceId: "KillAgent"
Filename: "{app}\PulseAgent.exe"; Parameters: "--uninstall-cleanup"; Flags: runhidden waituntilterminated; RunOnceId: "Cleanup"

[Code]
{ Kill any running agent before copying new files (needed for self-update /
  reinstall, because the app has no window for Inno's CloseApplications). }
procedure KillRunningAgent();
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM PulseAgent.exe /F',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  KillRunningAgent();
  Result := '';
end;
