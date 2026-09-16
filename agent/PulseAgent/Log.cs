using System.IO;

namespace PulseAgent;

// Lightweight file logger. A hidden agent has no console, so all diagnostics go
// to %LOCALAPPDATA%\Pulse\agent.log (size-capped).
public static class Log
{
    private static readonly object Gate = new();
    private static readonly string LogPath =
        Path.Combine(Paths.DataDir, "agent.log");

    public static void Info(string message) => Write("INFO", message);
    public static void Warn(string message) => Write("WARN", message);
    public static void Error(string message, Exception? ex = null) =>
        Write("ERROR", ex == null ? message : $"{message} :: {ex}");

    private static void Write(string level, string message)
    {
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(Paths.DataDir);
                var file = new FileInfo(LogPath);
                if (file.Exists && file.Length > 1_000_000) // rotate at ~1 MB
                    File.Delete(LogPath);
                File.AppendAllText(LogPath,
                    $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{level}] {message}{Environment.NewLine}");
            }
        }
        catch { /* logging must never throw */ }
    }
}

public static class Paths
{
    public static string DataDir =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Pulse");
}
