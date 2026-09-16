using System.Text.Json;
using System.Text.Json.Serialization;

namespace PulseAgent.Sync;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
}

public sealed class EnrollRequest
{
    public string EnrollKey { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string? Hostname { get; set; }
    public string? Os { get; set; }
    public string? AgentVersion { get; set; }
}

public sealed class EnrollResponse
{
    public string DeviceId { get; set; } = "";
    public string DeviceToken { get; set; } = "";
    public SettingsDto? Settings { get; set; }
}

public sealed class SyncModeDto
{
    public string Mode { get; set; } = "live";
    public int LivePollSeconds { get; set; } = 60;
    public string TimedAt { get; set; } = "18:00";
}

public sealed class SettingsDto
{
    public int Rev { get; set; }
    public int IdleThresholdSeconds { get; set; } = 30;
    public SyncModeDto Sync { get; set; } = new();
    public string MinAgentVersion { get; set; } = "0.0.0";
}

public sealed class WindowDto
{
    public string App { get; set; } = "";
    public string Title { get; set; } = "";
    public int Seconds { get; set; }
}

public sealed class BucketDto
{
    public long Ts { get; set; }
    public long Keypresses { get; set; }
    public int MouseActiveSec { get; set; }
    public int MouseIdleSec { get; set; }
    public List<WindowDto> Windows { get; set; } = new();
}

public sealed class SyncRequest
{
    public string? AgentVersion { get; set; }
    public List<BucketDto> Buckets { get; set; } = new();
}

public sealed class SyncResponse
{
    public bool Ok { get; set; }
    public SettingsDto? Settings { get; set; }
    public long ServerTime { get; set; }
}

public sealed class UpdateCheckResponse
{
    public string? Repo { get; set; }
    public string MinVersion { get; set; } = "0.0.0";
    public bool Mandatory { get; set; }
}
