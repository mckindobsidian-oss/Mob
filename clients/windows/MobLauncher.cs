using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class MobLauncher
{
    private const string Site = "https://usemob.netlify.app/";

    [STAThread]
    private static void Main(string[] args)
    {
        string url = args.Length == 1 && args[0] == "--local" ? "http://localhost:4173/" : Site;
        foreach (string browser in new[] { "msedge.exe", "chrome.exe" })
        {
            string path = BrowserPath(browser);
            if (path != null && Open(path, "--app=" + url)) return;
        }
        if (!Open(url, null)) MessageBox.Show("Open " + url + " in your browser.", "Mob");
    }

    private static string BrowserPath(string browser)
    {
        foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
        {
            using (RegistryKey key = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + browser))
            {
                string path = key == null ? null : key.GetValue(null) as string;
                if (File.Exists(path)) return path;
            }
        }
        return null;
    }

    private static bool Open(string file, string args)
    {
        try
        {
            Process.Start(new ProcessStartInfo(file, args ?? "") { UseShellExecute = true });
            return true;
        }
        catch (System.ComponentModel.Win32Exception) { return false; }
    }
}
