using System.Reflection;

namespace PulseAgent;

public static class AppInfo
{
    // e.g. "0.1.0" — set from the <Version> csproj property / release tag.
    public static string Version { get; } =
        (Assembly.GetExecutingAssembly().GetName().Version is { } v)
            ? $"{v.Major}.{v.Minor}.{v.Build}"
            : "0.0.0";

    public const string ProductName = "Pulse Agent";
    public const string RunKeyName = "PulseAgent";
}
