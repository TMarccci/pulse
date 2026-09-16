using System.Threading;

namespace PulseAgent.Native;

// Low-level keyboard hook that counts key-down events. The callback does the
// bare minimum (one interlocked increment) so it never delays input.
public sealed class KeyboardHook : IDisposable
{
    private IntPtr _hook = IntPtr.Zero;
    private NativeMethods.HookProc? _proc;   // kept alive to prevent GC
    private long _count;

    public void Install()
    {
        _proc = Callback;
        _hook = NativeMethods.SetWindowsHookEx(
            NativeMethods.WH_KEYBOARD_LL, _proc, NativeMethods.GetModuleHandle(null), 0);
        if (_hook == IntPtr.Zero) Log.Error("Failed to install keyboard hook");
    }

    // Atomically read and reset the running count for the current bucket.
    public long TakeCount() => Interlocked.Exchange(ref _count, 0);

    private IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode == NativeMethods.HC_ACTION)
        {
            int msg = (int)wParam;
            if (msg == NativeMethods.WM_KEYDOWN || msg == NativeMethods.WM_SYSKEYDOWN)
                Interlocked.Increment(ref _count);
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
