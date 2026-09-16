using System.Runtime.InteropServices;
using System.Windows;
using PulseAgent.Startup;
using PulseAgent.Sync;

namespace PulseAgent.Ui;

public partial class ConfigWindow : Window
{
    private readonly AgentConfig _config;
    public SettingsDto? InitialSettings { get; private set; }

    public ConfigWindow(AgentConfig config)
    {
        InitializeComponent();
        _config = config;
        ServerBox.Text = "";
        PortBox.Text = "8080";
        NameBox.Text = Environment.MachineName;
    }

    private async void OnEnroll(object sender, RoutedEventArgs e)
    {
        string host = CleanHost(ServerBox.Text);
        string key = KeyBox.Text.Trim();
        string name = NameBox.Text.Trim();

        if (host == "") { Status("Enter the server address.", true); return; }
        if (!int.TryParse(PortBox.Text.Trim(), out int port) || port is < 1 or > 65535)
        { Status("Enter a valid port.", true); return; }
        if (key == "") { Status("Enter the enrollment key.", true); return; }
        if (name == "") { Status("Enter a device name.", true); return; }

        string scheme = HttpsBox.IsChecked == true ? "https" : "http";
        string baseUrl = $"{scheme}://{host}:{port}";
        bool insecure = InsecureBox.IsChecked == true;

        SetBusy(true);
        Status("Contacting server…", false);
        try
        {
            using var client = new SyncClient(baseUrl, insecure);
            var resp = await client.EnrollAsync(new EnrollRequest
            {
                EnrollKey = key,
                DeviceName = name,
                Hostname = Environment.MachineName,
                Os = RuntimeInformation.OSDescription,
                AgentVersion = AppInfo.Version,
            });

            _config.ServerBaseUrl = baseUrl;
            _config.DeviceName = name;
            _config.AllowInsecureTls = insecure;
            _config.DeviceId = resp.DeviceId;
            _config.DeviceToken = resp.DeviceToken;
            _config.Save();
            Autostart.Enable();
            InitialSettings = resp.Settings;

            Status("Enrolled successfully. Starting monitoring…", false);
            DialogResult = true;
            Close();
        }
        catch (SyncException ex)
        {
            Status(ex.Message, true);
            SetBusy(false);
        }
        catch (Exception ex)
        {
            Status($"Could not reach the server: {ex.Message}", true);
            SetBusy(false);
        }
    }

    private void OnCancel(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    // Accept a bare host, an IP, or a pasted URL and return just the host.
    private static string CleanHost(string input)
    {
        string s = input.Trim();
        if (s == "") return "";
        int scheme = s.IndexOf("://", StringComparison.Ordinal);
        if (scheme >= 0) s = s[(scheme + 3)..];
        int slash = s.IndexOf('/');
        if (slash >= 0) s = s[..slash];
        int colon = s.IndexOf(':');
        if (colon >= 0) s = s[..colon];
        return s;
    }

    private void Status(string message, bool error)
    {
        StatusText.Text = message;
        StatusText.Foreground = error
            ? System.Windows.Media.Brushes.IndianRed
            : (System.Windows.Media.Brush)FindResource("Muted");
    }

    private void SetBusy(bool busy)
    {
        EnrollButton.IsEnabled = !busy;
        CancelButton.IsEnabled = !busy;
    }
}
