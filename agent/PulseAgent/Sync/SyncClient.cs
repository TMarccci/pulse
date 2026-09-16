using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace PulseAgent.Sync;

public sealed class SyncClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;

    public SyncClient(string baseUrl, bool allowInsecureTls)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        var handler = new HttpClientHandler();
        if (allowInsecureTls)
            handler.ServerCertificateCustomValidationCallback = (_, _, _, _) => true;
        _http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd($"PulseAgent/{AppInfo.Version}");
    }

    public async Task<EnrollResponse> EnrollAsync(EnrollRequest req, CancellationToken ct = default)
    {
        var res = await _http.PostAsJsonAsync($"{_baseUrl}/api/agent/enroll", req, Json.Options, ct);
        if (!res.IsSuccessStatusCode)
            throw new SyncException($"Enrollment rejected ({(int)res.StatusCode}). Check the enrollment key and server address.");
        return (await res.Content.ReadFromJsonAsync<EnrollResponse>(Json.Options, ct))
               ?? throw new SyncException("Empty enrollment response.");
    }

    public async Task<SyncResponse> SyncAsync(string token, SyncRequest req, CancellationToken ct = default)
    {
        using var msg = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/api/agent/sync");
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        msg.Content = JsonContent.Create(req, options: Json.Options);
        var res = await _http.SendAsync(msg, ct);
        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new SyncException("Device token rejected (401).") { Unauthorized = true };
        if (!res.IsSuccessStatusCode)
            throw new SyncException($"Sync failed ({(int)res.StatusCode}).");
        return (await res.Content.ReadFromJsonAsync<SyncResponse>(Json.Options, ct))
               ?? throw new SyncException("Empty sync response.");
    }

    public async Task<UpdateCheckResponse?> UpdateCheckAsync(CancellationToken ct = default)
    {
        try
        {
            return await _http.GetFromJsonAsync<UpdateCheckResponse>(
                $"{_baseUrl}/api/agent/update-check?version={AppInfo.Version}", Json.Options, ct);
        }
        catch (Exception ex) { Log.Warn($"Update-check failed: {ex.Message}"); return null; }
    }

    public void Dispose() => _http.Dispose();
}

public sealed class SyncException : Exception
{
    public bool Unauthorized { get; init; }
    public SyncException(string message) : base(message) { }
}
