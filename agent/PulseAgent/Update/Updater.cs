using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using PulseAgent.Sync;

namespace PulseAgent.Update;

// Checks the configured GitHub repo's latest release and, if it is newer than
// the running version, downloads the installer and launches it silently.
public sealed partial class Updater
{
    // Hardcoded Pulse monorepo. The server may still override via update-check.
    public const string DefaultRepo = "TMarccci/pulse";

    // Only agent releases are tagged like this; server releases are ignored.
    private const string TagPrefix = "agent-v";

    private readonly HttpClient _http;

    public Updater()
    {
        _http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd($"PulseAgent/{AppInfo.Version}");
        _http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
    }

    public async Task CheckAndUpdateAsync(UpdateCheckResponse? info, CancellationToken ct = default)
    {
        var repo = string.IsNullOrWhiteSpace(info?.Repo) ? DefaultRepo : info!.Repo!;
        if (string.IsNullOrWhiteSpace(repo)) return;

        try
        {
            // Monorepo: list releases and pick the newest agent-tagged one.
            var releases = await _http.GetFromJsonAsync<List<GhRelease>>(
                $"https://api.github.com/repos/{repo}/releases?per_page=30", ct);
            var rel = releases?
                .Where(r => r.TagName != null && !r.Draft && !r.Prerelease
                            && r.TagName.StartsWith(TagPrefix, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(r => ParseVersion(r.TagName!), Comparer<string>.Create(CompareVersions))
                .FirstOrDefault();
            if (rel?.TagName == null) return;

            var latest = ParseVersion(rel.TagName);
            if (CompareVersions(latest, AppInfo.Version) <= 0)
            {
                Log.Info($"Up to date (latest {latest}, running {AppInfo.Version}).");
                return;
            }

            var asset = rel.Assets?.FirstOrDefault(a =>
                a.Name != null && a.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
                && a.Name.Contains("Setup", StringComparison.OrdinalIgnoreCase));
            if (asset?.DownloadUrl == null)
            {
                Log.Warn("Newer release found but no Setup .exe asset attached.");
                return;
            }

            Log.Info($"Updating {AppInfo.Version} → {latest} from {asset.Name}.");
            var tmp = Path.Combine(Path.GetTempPath(), $"PulseAgentSetup-{latest}.exe");
            await using (var s = await _http.GetStreamAsync(asset.DownloadUrl, ct))
            await using (var f = File.Create(tmp))
                await s.CopyToAsync(f, ct);

            // Run the installer silently; it will stop this process and replace files.
            Process.Start(new ProcessStartInfo
            {
                FileName = tmp,
                Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCANCEL",
                UseShellExecute = true,
            });
            Log.Info("Installer launched; exiting for update.");
            Environment.Exit(0);
        }
        catch (Exception ex) { Log.Warn($"Update check/apply failed: {ex.Message}"); }
    }

    private static string ParseVersion(string tag)
    {
        var m = VersionRegex().Match(tag);
        return m.Success ? m.Value : "0.0.0";
    }

    // Returns >0 if a>b, <0 if a<b, 0 if equal.
    public static int CompareVersions(string a, string b)
    {
        int[] pa = Parts(a), pb = Parts(b);
        for (int i = 0; i < 3; i++)
        {
            if (pa[i] != pb[i]) return pa[i].CompareTo(pb[i]);
        }
        return 0;
    }

    private static int[] Parts(string v)
    {
        var p = v.Split('.');
        int[] r = new int[3];
        for (int i = 0; i < 3; i++) r[i] = i < p.Length && int.TryParse(p[i], out var n) ? n : 0;
        return r;
    }

    [GeneratedRegex(@"\d+\.\d+\.\d+")]
    private static partial Regex VersionRegex();

    private sealed class GhRelease
    {
        [JsonPropertyName("tag_name")] public string? TagName { get; set; }
        [JsonPropertyName("draft")] public bool Draft { get; set; }
        [JsonPropertyName("prerelease")] public bool Prerelease { get; set; }
        [JsonPropertyName("assets")] public List<GhAsset>? Assets { get; set; }
    }
    private sealed class GhAsset
    {
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("browser_download_url")] public string? DownloadUrl { get; set; }
    }
}
