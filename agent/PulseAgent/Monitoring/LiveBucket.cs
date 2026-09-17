using PulseAgent.Sync;

namespace PulseAgent.Monitoring;

// Accumulates one minute of activity before it is finalized into a BucketDto.
internal sealed class LiveBucket
{
    public long Ts { get; }
    public long Keypresses { get; set; }
    public long MouseClicks { get; set; }
    public int MouseActiveSec { get; set; }
    public int MouseIdleSec { get; set; }
    private readonly Dictionary<(string app, string title), int> _windows = new();

    public LiveBucket(long minuteAlignedTs) => Ts = minuteAlignedTs;

    public void AddWindowSecond(string app, string title)
    {
        var key = (app, title);
        _windows[key] = _windows.TryGetValue(key, out var v) ? v + 1 : 1;
    }

    public BucketDto ToDto() => new()
    {
        Ts = Ts,
        Keypresses = Keypresses,
        MouseClicks = MouseClicks,
        MouseActiveSec = MouseActiveSec,
        MouseIdleSec = MouseIdleSec,
        Windows = _windows
            .Select(kv => new WindowDto { App = kv.Key.app, Title = kv.Key.title, Seconds = kv.Value })
            .OrderByDescending(w => w.Seconds)
            .ToList(),
    };
}
