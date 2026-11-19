using System;
internal static class ActivityCheck
{
    private static void Main()
    {
        Check(MobActivity.CountedSeconds("editor", "editor", 0.25) == 0.25);
        Check(MobActivity.CountedSeconds("editor", "browser", 0.25) == 0);
        Check(MobActivity.CountedSeconds("", "", 0.25) == 0);
        Check(MobActivity.CountedSeconds("editor", "editor", 8) == 0);
        Check(MobActivity.CountedSeconds("editor", "editor", -1) == 0);
        Console.WriteLine("Foreground activity checks passed.");
    }
    private static void Check(bool valid)
    {
        if (!valid) throw new Exception("Invalid activity interval counted");
    }
}
