namespace PulseAgent.Native;

// Low-level mouse hook that records the timestamp of the most recent mouse
// activity (move, click, wheel). Active vs. idle time is derived from how long
// ago that was, using the server-configured idle threshold.
public sealed class MouseHook : IDisposable
{
    private IntPtr _hook = IntPtr.Zero;
    private NativeMethods.HookProc? _proc;
    private long _lastActivityTick = Environment.TickCount64;
    private long _clicks;

    public void Install()
    {
        _proc = Callback;
        _hook = NativeMethods.SetWindowsHookEx(
            NativeMethods.WH_MOUSE_LL, _proc, NativeMethods.GetModuleHandle(null), 0);
        if (_hook == IntPtr.Zero) Log.Error("Failed to install mouse hook");
    }

    // Seconds since the last mouse activity.
    public double SecondsSinceActivity =>
        (Environment.TickCount64 - Interlocked.Read(ref _lastActivityTick)) / 1000.0;

    // Atomically read and reset the click count for the current bucket.
    public long TakeClicks() => Interlocked.Exchange(ref _clicks, 0);

    private IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode == NativeMethods.HC_ACTION)
        {
            // Any mouse message counts as activity (for idle tracking).
            Interlocked.Exchange(ref _lastActivityTick, Environment.TickCount64);

            // Count button-down events as clicks (left/right/middle/x).
            int msg = (int)wParam;
            if (msg is NativeMethods.WM_LBUTTONDOWN or NativeMethods.WM_RBUTTONDOWN
                or NativeMethods.WM_MBUTTONDOWN or NativeMethods.WM_XBUTTONDOWN)
                Interlocked.Increment(ref _clicks);
        }
        return NativeMethods.CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    public void Dispose()
    {
        if (_hook != IntPtr.Zero)
        {
            NativeMethods.UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
        }
    }
}
