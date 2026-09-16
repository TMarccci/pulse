using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PulseAgent;

// Persisted agent configuration. The device token is encrypted at rest with
// DPAPI (per-user) so it cannot be read from another account.
public sealed class AgentConfig
{
    public string ServerBaseUrl { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string DeviceId { get; set; } = "";

    // Accept self-signed / untrusted TLS certs (common for on-prem servers).
    public bool AllowInsecureTls { get; set; }

    [JsonPropertyName("deviceTokenProtected")]
    public string DeviceTokenProtected { get; set; } = "";

    [JsonIgnore]
    public string DeviceToken
    {
        get => Unprotect(DeviceTokenProtected);
        set => DeviceTokenProtected = Protect(value);
    }

    [JsonIgnore]
    public bool IsEnrolled =>
        !string.IsNullOrEmpty(ServerBaseUrl) && !string.IsNullOrEmpty(DeviceTokenProtected);

    private static readonly string FilePath = Path.Combine(Paths.DataDir, "config.json");
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public static AgentConfig Load()
    {
        try
        {
            if (File.Exists(FilePath))
                return JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(FilePath)) ?? new AgentConfig();
        }
        catch (Exception ex) { Log.Error("Failed to load config", ex); }
        return new AgentConfig();
    }

    public void Save()
    {
        Directory.CreateDirectory(Paths.DataDir);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(this, JsonOpts));
    }

    private static string Protect(string plain)
    {
        if (string.IsNullOrEmpty(plain)) return "";
        var bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(plain), null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(bytes);
    }

    private static string Unprotect(string protectedB64)
    {
        if (string.IsNullOrEmpty(protectedB64)) return "";
        try
        {
            var bytes = ProtectedData.Unprotect(Convert.FromBase64String(protectedB64), null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch (Exception ex) { Log.Error("Failed to decrypt device token", ex); return ""; }
    }
}
