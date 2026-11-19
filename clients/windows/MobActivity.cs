using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

internal static class MobActivity
{
    [StructLayout(LayoutKind.Sequential)]
    private struct LastInput { public uint size; public uint tick; }
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LastInput lastInput);
    [DllImport("user32.dll")] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);

    private static void Main()
    {
        string previous = "";
        long last = Stopwatch.GetTimestamp();
        while (true)
        {
            Thread.Sleep(250);
            long now = Stopwatch.GetTimestamp();
            double elapsed = (now - last) / (double)Stopwatch.Frequency;
            last = now;
            string current = ActiveApplication();
            double seconds = CountedSeconds(previous, current, elapsed);
            long at = (long)(DateTime.UtcNow - new DateTime(1970,1,1)).TotalMilliseconds;
            Console.WriteLine(current + "\t" + seconds.ToString("0.000", System.Globalization.CultureInfo.InvariantCulture) + "\t" + at);
            previous = current;
        }
    }

    internal static double CountedSeconds(string previous, string current, double elapsed)
    {
        return current.Length > 0 && current == previous && elapsed > 0 && elapsed < 1 ? elapsed : 0;
    }

    private static string ActiveApplication()
    {
        IntPtr desktop = OpenInputDesktop(0, false, 0x0100);
        if (desktop == IntPtr.Zero) return "";
        CloseDesktop(desktop);
        LastInput input = new LastInput { size = (uint)Marshal.SizeOf(typeof(LastInput)) };
        if (!GetLastInputInfo(ref input) || unchecked((uint)Environment.TickCount - input.tick) > 60000) return "";
        uint id;
        GetWindowThreadProcessId(GetForegroundWindow(), out id);
        if (id == 0) return "";
        try
        {
            using (Process process = Process.GetProcessById((int)id))
            {
                string name = process.ProcessName;
                switch (name.ToLowerInvariant())
                {
                    case "chrome": case "msedge": case "brave":
                    case "opera": case "vivaldi": return "";
                    case "lockapp": case "logonui": case "searchhost": case "startmenuexperiencehost": return "";
                    default: return name;
                }
            }
        }
        catch (ArgumentException) { return ""; }
        catch (InvalidOperationException) { return ""; }
        catch (System.ComponentModel.Win32Exception) { return ""; }
    }
}
