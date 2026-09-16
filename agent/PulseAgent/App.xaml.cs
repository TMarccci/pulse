using System.IO;
using System.Threading;
using System.Windows;
using PulseAgent.Monitoring;
using PulseAgent.Startup;
using PulseAgent.Sync;
using PulseAgent.Ui;

namespace PulseAgent;

public partial class App : Application
{
    private Mutex? _singleInstance;
    private AgentRuntime? _runtime;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        var args = e.Args;

        // Maintenance modes invoked by the (un)installer.
        if (args.Contains("--uninstall-cleanup")) { UninstallCleanup(); Shutdown(); return; }
        if (args.Contains("--selftest")) { _ = RunSelfTestAsync(args); return; }

        // Only one agent per user session.
        _singleInstance = new Mutex(true, @"Local\PulseAgentSingleton", out bool isNew);
        if (!isNew) { Shutdown(); return; }

        DispatcherUnhandledException += (_, ev) =>
        { Log.Error("Unhandled UI exception", ev.Exception); ev.Handled = true; };

        var config = AgentConfig.Load();
        if (config.IsEnrolled)
        {
            StartMonitoring(config, null);           // silent, hidden
        }
        else
        {
            ShowConfigWindow(config);                // first run
        }
    }

    private void ShowConfigWindow(AgentConfig config)
    {
        var win = new ConfigWindow(config);
        bool? ok = win.ShowDialog();
        if (ok == true)
        {
            StartMonitoring(config, win.InitialSettings);
        }
        else
        {
            Shutdown();                              // user cancelled setup
        }
    }

    private void StartMonitoring(AgentConfig config, SettingsDto? initial)
    {
        try
        {
            _runtime = new AgentRuntime();
            _runtime.Start(config, initial);
            // No window, no tray icon — the app keeps running via the dispatcher.
        }
        catch (Exception ex)
        {
            Log.Error("Failed to start monitoring", ex);
            Shutdown();
        }
    }

    private static void UninstallCleanup()
    {
        Autostart.Disable();
        try
        {
            if (Directory.Exists(Paths.DataDir)) Directory.Delete(Paths.DataDir, recursive: true);
        }
        catch (Exception ex) { Log.Warn($"Cleanup could not remove data dir: {ex.Message}"); }
    }

    // Headless smoke test: enroll + one sync against a server, writing results to
    // %TEMP%\pulse-agent-selftest.log (used by the build pipeline / manual QA).
    // Args: --selftest --server <url> --key <enrollKey> [--name <deviceName>] [--insecure]
    private async Task RunSelfTestAsync(string[] args)
    {
        string outPath = Path.Combine(Path.GetTempPath(), "pulse-agent-selftest.log");
        void W(string m) => File.AppendAllText(outPath, m + Environment.NewLine);
        try
        {
            File.WriteAllText(outPath, $"Pulse Agent self-test {AppInfo.Version}\n");
            string Get(string k, string def = "") { int i = Array.IndexOf(args, k); return i >= 0 && i + 1 < args.Length ? args[i + 1] : def; }
            string server = Get("--server");
            string key = Get("--key");
            string name = Get("--name", Environment.MachineName + "-selftest");
            bool insecure = args.Contains("--insecure");
            if (server == "" || key == "") { W("ERROR: --server and --key required"); Shutdown(); return; }

            using var client = new SyncClient(server, insecure);
            var enroll = await client.EnrollAsync(new EnrollRequest
            {
                EnrollKey = key, DeviceName = name,
                Hostname = Environment.MachineName, Os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                AgentVersion = AppInfo.Version,
            });
            W($"ENROLL OK deviceId={enroll.DeviceId} idle={enroll.Settings?.IdleThresholdSeconds}");

            if (args.Contains("--persist"))
            {
                var cfg = new AgentConfig
                {
                    ServerBaseUrl = server, DeviceName = name,
                    AllowInsecureTls = insecure, DeviceId = enroll.DeviceId,
                    DeviceToken = enroll.DeviceToken,
                };
                cfg.Save();
                W("CONFIG PERSISTED");
            }

            long ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60 * 60;
            var res = await client.SyncAsync(enroll.DeviceToken, new SyncRequest
            {
                AgentVersion = AppInfo.Version,
                Buckets = new() { new BucketDto {
                    Ts = ts, Keypresses = 42, MouseActiveSec = 50, MouseIdleSec = 10,
                    Windows = new() { new WindowDto { App = "selftest.exe", Title = "QA", Seconds = 50 } } } },
            });
            W($"SYNC OK serverTime={res.ServerTime} mode={res.Settings?.Sync.Mode}");
            W("SELFTEST PASS");
        }
        catch (Exception ex) { W("SELFTEST FAIL: " + ex.Message); }
        finally { Shutdown(); }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _runtime?.Dispose();
        _singleInstance?.Dispose();
        base.OnExit(e);
    }
}
