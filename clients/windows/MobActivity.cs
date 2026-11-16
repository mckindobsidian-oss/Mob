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

    private static void Main()
    {
        string previous = "";
        while (true)
        {
            string current = ActiveApplication();
            Console.WriteLine(current == previous ? current : "");
            previous = current;
            Thread.Sleep(5000);
        }
    }

    private static string ActiveApplication()
    {
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
                    case "mob": case "electron": case "chrome": case "msedge": case "brave":
                    case "firefox": case "opera": case "vivaldi": case "explorer": return "";
                    default: return name;
                }
            }
        }
        catch (ArgumentException) { return ""; }
        catch (InvalidOperationException) { return ""; }
    }
}
