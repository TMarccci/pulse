using System.Threading;
using PulseAgent.Native;

namespace PulseAgent.Monitoring;

// Samples input once per second and rolls the data into per-minute buckets that
// are handed to the spooler when each minute completes.
public sealed class ActivityCollector : IDisposable
{
    private readonly KeyboardHook _keyboard;
    private readonly MouseHook _mouse;
    private readonly Spooler _spooler;
    private readonly object _gate = new();

    private Timer? _timer;
    private LiveBucket? _current;

    // Updated live from server settings.
    private volatile int _idleThresholdSeconds = 30;
    public int IdleThresholdSeconds
    {
        get => _idleThresholdSeconds;
        set => _idleThresholdSeconds = Math.Max(1, value);
    }

    public ActivityCollector(KeyboardHook keyboard, MouseHook mouse, Spooler spooler)
    {
        _keyboard = keyboard;
        _mouse = mouse;
        _spooler = spooler;
    }

    public void Start()
    {
        _timer = new Timer(_ => Tick(), null, 1000, 1000);
        Log.Info("Activity collector started.");
    }

    private static long UnixNow() => DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    private static long MinuteAlign(long unix) => unix / 60 * 60;

    private void Tick()
    {
        try
        {
            long minute = MinuteAlign(UnixNow());
            lock (_gate)
            {
                if (_current == null)
                {
                    _current = new LiveBucket(minute);
                }
                else if (_current.Ts != minute)
                {
                    _spooler.Enqueue(_current.ToDto());   // finalize completed minute
                    _current = new LiveBucket(minute);
                }

                // Keypresses + mouse clicks accumulated since the last tick.
                _current.Keypresses += _keyboard.TakeCount();
                _current.MouseClicks += _mouse.TakeClicks();

                // Active vs. idle second, by mouse inactivity threshold.
                if (_mouse.SecondsSinceActivity <= _idleThresholdSeconds)
                    _current.MouseActiveSec++;
                else
                    _current.MouseIdleSec++;

                // Attribute this second to the focused window.
                var win = ForegroundWindow.Current();
                if (win is { } w)
                    _current.AddWindowSecond(w.App, string.IsNullOrEmpty(w.Title) ? w.App : w.Title);
            }
        }
        catch (Exception ex) { Log.Error("Collector tick failed", ex); }
    }

    // Push the in-progress minute to the spool (used on shutdown / before a
    // timed end-of-day flush so nothing is lost).
    public void FinalizeCurrent()
    {
        lock (_gate)
        {
            if (_current != null && (_current.Keypresses > 0 || _current.MouseActiveSec > 0 || _current.MouseIdleSec > 0))
            {
                _spooler.Enqueue(_current.ToDto());
                _current = null;
            }
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        FinalizeCurrent();
    }
}
