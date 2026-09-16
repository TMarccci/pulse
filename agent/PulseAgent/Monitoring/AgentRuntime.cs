using PulseAgent.Native;
using PulseAgent.Startup;
using PulseAgent.Sync;
using PulseAgent.Update;

namespace PulseAgent.Monitoring;

// Owns every long-lived monitoring component. Created once when the agent enters
// its hidden monitoring state; kept referenced so nothing is garbage-collected.
public sealed class AgentRuntime : IDisposable
{
    private readonly KeyboardHook _keyboard = new();
    private readonly MouseHook _mouse = new();
    private Spooler? _spooler;
    private ActivityCollector? _collector;
    private SyncClient? _client;
    private SyncScheduler? _scheduler;
    private Updater? _updater;

    // Must be called on a thread that pumps Windows messages (the WPF UI thread),
    // because low-level hooks require a message loop on the installing thread.
    public void Start(AgentConfig config, SettingsDto? initialSettings)
    {
        Log.Info($"Starting Pulse Agent {AppInfo.Version} for device '{config.DeviceName}'.");

        _keyboard.Install();
        _mouse.Install();

        _spooler = new Spooler();
        _collector = new ActivityCollector(_keyboard, _mouse, _spooler);
        if (initialSettings != null) _collector.IdleThresholdSeconds = initialSettings.IdleThresholdSeconds;
        _collector.Start();

        _client = new SyncClient(config.ServerBaseUrl, config.AllowInsecureTls);
        _updater = new Updater();
        _scheduler = new SyncScheduler(_client, _spooler, _collector, config, initialSettings, _updater);
        _scheduler.Start();

        // Belt-and-braces: the installer sets this too, but ensure it persists.
        Autostart.Enable();
    }

    public void Dispose()
    {
        _scheduler?.Dispose();
        _collector?.Dispose();     // finalizes the in-progress minute
        _client?.Dispose();
        _keyboard.Dispose();
        _mouse.Dispose();
    }
}
