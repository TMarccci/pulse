using System.Diagnostics;
using Microsoft.Win32;

namespace PulseAgent.Startup;

// Registers the agent to launch at user logon via the HKCU Run key. This runs
// in the user's session (needed for input hooks) without requiring elevation.
public static class Autostart
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

    public static void Enable()
    {
        try
        {
            var exe = Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(exe)) return;
            using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true)
                            ?? Registry.CurrentUser.CreateSubKey(RunKey);
            key.SetValue(AppInfo.RunKeyName, $"\"{exe}\"");
            Log.Info("Autostart enabled.");
        }
        catch (Exception ex) { Log.Error("Failed to enable autostart", ex); }
    }

    public static void Disable()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true);
            key?.DeleteValue(AppInfo.RunKeyName, throwOnMissingValue: false);
            Log.Info("Autostart disabled.");
        }
        catch (Exception ex) { Log.Error("Failed to disable autostart", ex); }
    }

    public static bool IsEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            return key?.GetValue(AppInfo.RunKeyName) != null;
        }
        catch { return false; }
    }
}
