using System.Diagnostics;
using System.Text;

namespace PulseAgent.Native;

public readonly record struct WindowInfo(string App, string Title);

public static class ForegroundWindow
{
    // Returns the current foreground window's owning process ("chrome.exe") and
    // window title. Returns null when nothing is focused (e.g. lock screen).
    public static WindowInfo? Current()
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return null;

        string title = "";
        int len = NativeMethods.GetWindowTextLength(hwnd);
        if (len > 0)
        {
            var sb = new StringBuilder(len + 1);
            NativeMethods.GetWindowText(hwnd, sb, sb.Capacity);
            title = sb.ToString();
        }

        string app = "unknown";
        try
        {
            NativeMethods.GetWindowThreadProcessId(hwnd, out uint pid);
            if (pid != 0)
            {
                using var proc = Process.GetProcessById((int)pid);
                app = proc.ProcessName + ".exe";
            }
        }
        catch { /* process may have exited */ }

        return new WindowInfo(app, title);
    }
}
