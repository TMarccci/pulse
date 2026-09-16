using System.Globalization;
using PulseAgent.Monitoring;
using PulseAgent.Update;

namespace PulseAgent.Sync;

// Drives data delivery according to the server-configured sync mode and applies
// settings pushed back from the server on every sync.
public sealed class SyncScheduler : IDisposable
{
    private readonly SyncClient _client;
    private readonly Spooler _spooler;
    private readonly ActivityCollector _collector;
    private readonly AgentConfig _config;
    private readonly Updater? _updater;
    private readonly CancellationTokenSource _cts = new();

    private SettingsDto _settings = new();
    private DateTime _lastFlushUtc = DateTime.MinValue;
    private DateTime _lastUpdateCheckUtc = DateTime.MinValue;
    private DateOnly? _lastTimedFlushDay;

    public SyncScheduler(SyncClient client, Spooler spooler, ActivityCollector collector,
        AgentConfig config, SettingsDto? initial, Updater? updater)
    {
        _client = client;
        _spooler = spooler;
        _collector = collector;
        _config = config;
        _updater = updater;
        if (initial != null) ApplySettings(initial);
    }

    public void Start() => _ = Task.Run(() => LoopAsync(_cts.Token));

    private async Task LoopAsync(CancellationToken ct)
    {
        Log.Info($"Sync scheduler started (mode={_settings.Sync.Mode}).");
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var nowUtc = DateTime.UtcNow;
                if (_settings.Sync.Mode == "timed") await MaybeTimedFlush(ct);
                else await MaybeLiveFlush(nowUtc, ct);

                // Update check every 6 hours.
                if ((nowUtc - _lastUpdateCheckUtc).TotalHours >= 6)
                {
                    _lastUpdateCheckUtc = nowUtc;
                    await CheckForUpdatesAsync(ct);
                }
            }
            catch (Exception ex) { Log.Error("Scheduler loop error", ex); }

            try { await Task.Delay(1000, ct); } catch { break; }
        }
    }

    private async Task MaybeLiveFlush(DateTime nowUtc, CancellationToken ct)
    {
        if ((nowUtc - _lastFlushUtc).TotalSeconds >= _settings.Sync.LivePollSeconds)
            await FlushAsync(ct);
    }

    private async Task MaybeTimedFlush(CancellationToken ct)
    {
        var local = DateTime.Now;
        var today = DateOnly.FromDateTime(local);
        if (_lastTimedFlushDay == today) return;

        if (TimeOnly.TryParse(_settings.Sync.TimedAt, CultureInfo.InvariantCulture, out var target)
            && TimeOnly.FromDateTime(local) >= target)
        {
            _collector.FinalizeCurrent();     // include the trailing partial minute
            await FlushAsync(ct);
            _lastTimedFlushDay = today;
        }
    }

    private async Task FlushAsync(CancellationToken ct)
    {
        var buckets = _spooler.Snapshot();
        var req = new SyncRequest { AgentVersion = AppInfo.Version, Buckets = buckets };
        try
        {
            var res = await _client.SyncAsync(_config.DeviceToken, req, ct);
            if (buckets.Count > 0) _spooler.CommitDelivered(buckets);
            _lastFlushUtc = DateTime.UtcNow;
            if (res.Settings != null) ApplySettings(res.Settings);
        }
        catch (SyncException ex) when (ex.Unauthorized)
        {
            Log.Warn("Sync unauthorized — device may be archived/removed on the server.");
            _lastFlushUtc = DateTime.UtcNow; // back off; keep buffering
        }
        catch (Exception ex)
        {
            Log.Warn($"Flush failed (will retry): {ex.Message}");
        }
    }

    private void ApplySettings(SettingsDto s)
    {
        _settings = s;
        _collector.IdleThresholdSeconds = s.IdleThresholdSeconds;
    }

    private async Task CheckForUpdatesAsync(CancellationToken ct)
    {
        if (_updater == null) return;
        var info = await _client.UpdateCheckAsync(ct);
        await _updater.CheckAndUpdateAsync(info, ct);
    }

    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
    }
}
