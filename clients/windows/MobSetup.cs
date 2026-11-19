using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Drawing;
using System.ComponentModel;
using System.Windows.Forms;
[assembly: AssemblyTitle("Mob Setup")]
[assembly: AssemblyProduct("Mob")]
[assembly: AssemblyVersion("1.5.1.0")]
class MobSetup : Form {
 Label status; ProgressBar progress; Button install;
 string destination; bool silent,noLaunch;
 [STAThread] static int Main(string[] args) {
  Application.EnableVisualStyles();
  var setup=new MobSetup(args);
  if(setup.silent){try{setup.Install();return 0;}catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
  Application.Run(setup);return 0;
 }
 MobSetup(string[] args){
  destination=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Mob");
  foreach(var arg in args){if(arg=="--silent")silent=true;if(arg=="--no-launch")noLaunch=true;if(arg.StartsWith("--install-dir="))destination=Path.GetFullPath(arg.Substring(14));}
  Text="Install Mob";ClientSize=new Size(480,250);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;
  BackColor=Color.FromArgb(17,23,19);ForeColor=Color.FromArgb(238,244,234);Font=new Font("Segoe UI",10);
  var title=new Label{Text="Meet your next focused day.",Location=new Point(28,26),Size=new Size(430,38),Font=new Font("Segoe UI",19,FontStyle.Bold)};Controls.Add(title);
  status=new Label{Text="Mob 1.5.1 installs for your Windows account.\nTasks, focus, and Flow — one calm workspace.",Location=new Point(28,79),Size=new Size(425,66)};Controls.Add(status);
  progress=new ProgressBar{Location=new Point(28,158),Size=new Size(424,12)};Controls.Add(progress);
  install=new Button{Text="Install and open Mob",Location=new Point(225,190),Size=new Size(227,36),FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(181,230,138),ForeColor=Color.FromArgb(23,42,28)};Controls.Add(install);
  install.Click+=(s,e)=>{if(install.Text=="Done"){Close();return;}install.Enabled=false;status.Text="Installing Mob…";var worker=new BackgroundWorker();worker.DoWork+=(a,b)=>Install();worker.RunWorkerCompleted+=(a,b)=>{if(b.Error!=null){status.Text=b.Error.Message;install.Enabled=true;}else{status.Text="Mob is installed. A shortcut is ready on your desktop.";progress.Value=100;install.Text="Done";install.Enabled=true;}};worker.RunWorkerAsync();};
 }
 void Install(){
  destination=Path.GetFullPath(destination).TrimEnd(Path.DirectorySeparatorChar);
  string local=Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
  if(!destination.StartsWith(local,StringComparison.OrdinalIgnoreCase) && !silent)throw new Exception("Choose a folder inside your local application data.");
  if(destination==Path.GetPathRoot(destination).TrimEnd(Path.DirectorySeparatorChar))throw new Exception("Invalid installation folder.");
  foreach(var process in Process.GetProcessesByName("Mob")){if(!silent)throw new InvalidOperationException("Quit Mob from its tray, then try again. Your existing data is kept.");try{if(string.Equals(process.MainModule.FileName,Path.Combine(destination,"Mob.exe"),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Quit the installed Mob from its tray, then try again.");}catch(InvalidOperationException){throw;}catch{}}
  Directory.CreateDirectory(destination);
  using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("MobPayload"))
  using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)){
   int count=0;
   foreach(var entry in zip.Entries){
    string relative=entry.FullName.Replace('\\','/');const string prefix="Mob-Windows-v1.5/";
    if(!relative.StartsWith(prefix,StringComparison.Ordinal))throw new Exception("Invalid package entry.");
    relative=relative.Substring(prefix.Length);if(relative.Length==0)continue;
    string path=Path.GetFullPath(Path.Combine(destination,relative));
    if(!path.StartsWith(destination+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Unsafe package path.");
    if(entry.Name.Length==0){Directory.CreateDirectory(path);continue;}
    Directory.CreateDirectory(Path.GetDirectoryName(path));using(var input=entry.Open())using(var output=File.Create(path))input.CopyTo(output);
    int percent=(++count*100)/zip.Entries.Count;if(!silent)BeginInvoke((Action)(()=>progress.Value=Math.Min(100,percent)));
   }
  }
  string executable=Path.Combine(destination,"Mob.exe");if(!File.Exists(executable))throw new Exception("Mob app was not installed.");
  if(!silent){Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"Mob.lnk"),executable);Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"Mob.lnk"),executable);}
  if(!noLaunch)Process.Start(new ProcessStartInfo(executable){UseShellExecute=true,WorkingDirectory=destination});
 }
 static void Shortcut(string path,string executable){
  Type type=Type.GetTypeFromProgID("WScript.Shell");object shell=Activator.CreateInstance(type),shortcut=type.InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{path});Type link=shortcut.GetType();
  link.InvokeMember("TargetPath",BindingFlags.SetProperty,null,shortcut,new object[]{executable});link.InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,shortcut,new object[]{Path.GetDirectoryName(executable)});link.InvokeMember("IconLocation",BindingFlags.SetProperty,null,shortcut,new object[]{executable+",0"});link.InvokeMember("Save",BindingFlags.InvokeMethod,null,shortcut,null);
 }
}
