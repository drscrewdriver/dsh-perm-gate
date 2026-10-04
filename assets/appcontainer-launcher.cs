/**
 * appcontainer-launcher.cs — dsh-perm-gate 的 Windows AppContainer 启动器。
 *
 * 职责（单一）：把一条 shell 命令放进 AppContainer 里执行——
 *   1. 对 workspace / temp 做幂等 ACE 授予（容器 SID 默认零环境访问，系统目录
 *      靠 ALL APPLICATION PACKAGES 默认 ACE，工作区必须显式开）；
 *   2. 容器 SID 由 OS 派生（动态绑定 KernelBase：Win8…24H2 走
 *      DeriveAppContainerSidFromAppContainerName，25H2+ 新代走
 *      AppContainerDeriveSidFromMoniker——自造 S-1-15-2 SID 一律被内核
 *      STATUS_INVALID_SID 拒收）；随后走官方属性列表路径
 *      （PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES + CreateProcessW），
 *      **能力清单为空** → WFP 层直接封死全部非回环出网，回环经
 *      CheckNetIsolation 豁免放行，出网只能走注入的本地过滤代理；
 *   3. cmd.exe /d /s /c "<解码后命令>" 在容器内执行，stdio 继承、退出码透传；
 *   4. 挂 kill-on-close Job，启动器被杀则整棵子进程树陪葬。
 *
 * 环境继承形态（windows-acl 验证过的）：启动器先改**自身**进程环境
 * （TMP/TEMP/代理变量），CreateProcessW 传 NULL env block 让子进程
 * 继承——不碰显式 env block 封送（同族代码在该路径上翻过车）。
 *
 * 约定：启动失败一律 stderr 打 `dsh-perm-gate-appcontainer: <原因>` 并以
 * 125 退出（runner-failure 签名，供门控结果审计归因）；命令本身的失败按
 * 子进程退出码原样透传。
 *
 * 语言等级：.NET Framework 自带 csc 只有 C# 5——不许用字符串插值、?. 等新语法。
 * 编译：csc /nologo /target:exe /optimize+ /r:System.Web.Extensions.dll
 *       /out:launcher.exe appcontainer-launcher.cs
 */
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Web.Script.Serialization;

namespace DshPermGate
{
    internal static class Launcher
    {
        const int EXIT_LAUNCH_FAILURE = 125;
        const string SIGNATURE = "dsh-perm-gate-appcontainer: ";

        // ── Win32 ──────────────────────────────────────────────────────────
        const uint JobObjectExtendedLimitInformation = 9;
        const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
        const uint STARTF_USESTDHANDLES = 0x0100;
        const uint HANDLE_FLAG_INHERIT = 0x1;

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct STARTUPINFOW
        {
            public uint cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public uint dwX;
            public uint dwY;
            public uint dwXSize;
            public uint dwYSize;
            public uint dwXCountChars;
            public uint dwYCountChars;
            public uint dwFillAttribute;
            public uint dwFlags;
            public ushort wShowWindow;
            public ushort cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct PROCESS_INFORMATION
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint dwProcessId;
            public uint dwThreadId;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr CreateJobObjectW(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetInformationJobObject(IntPtr hJob, uint infoClass, IntPtr info, uint length);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool CloseHandle(IntPtr handle);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool GetExitCodeProcess(IntPtr hProcess, out uint exitCode);

        // Exported from KernelBase as DeriveAppContainerSidFromAppContainerName
        // on Win8…24H2; resolution now goes through dynamic GetProcAddress
        // (see ContainerSidString) — no static import anymore.
        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        static extern long ConvertSidToStringSidW(IntPtr sid, out IntPtr stringSid);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr LocalFree(IntPtr handle);

        // ── 容器内启动走官方属性列表路径（kernel 侧自建 token）：
        //    PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES + CreateProcessW。
        //    NtCreateLowBoxToken 直调在 25H2+ 上拒收 OS 新派生的 moniker SID
        //    （STATUS_INVALID_SID，实测 26200），属性路径新旧两代内核通吃。
        const uint PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES = 0x00020009;
        const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;

        [StructLayout(LayoutKind.Sequential)]
        struct SECURITY_CAPABILITIES
        {
            public IntPtr Capabilities;      // PSID_AND_ATTRIBUTES (zero = no capabilities)
            public uint CapabilityCount;
            public IntPtr AppContainerSid;   // PSID
        }

        [StructLayout(LayoutKind.Sequential)]
        struct STARTUPINFOEXW
        {
            public STARTUPINFOW StartupInfo;
            public IntPtr lpAttributeList;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool UpdateProcThreadAttribute(
            IntPtr list, uint flags, IntPtr attribute, IntPtr value, UIntPtr size, IntPtr prevValue, IntPtr returnValue);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern void DeleteProcThreadAttributeList(IntPtr list);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool CreateProcessW(
            string lpApplicationName, string lpCommandLine,
            IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles,
            uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory,
            STARTUPINFOEXW lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

        static void Fail(string message)
        {
            Console.Error.WriteLine(SIGNATURE + message);
            Environment.Exit(EXIT_LAUNCH_FAILURE);
        }

        // ── ACL：给容器 SID 开工作区/临时目录（幂等） ─────────────────────
        static bool HasRights(DirectorySecurity ac, SecurityIdentifier sid, FileSystemRights rights)
        {
            foreach (FileSystemAccessRule rule in ac.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            {
                if (!sid.Equals(rule.IdentityReference)) continue;
                if (rule.AccessControlType != AccessControlType.Allow) continue;
                if ((rule.InheritanceFlags & InheritanceFlags.ContainerInherit) == 0) continue;
                if ((rule.FileSystemRights & rights) == rights) return true;
            }
            return false;
        }

        static void GrantTree(string directory, SecurityIdentifier sid, FileSystemRights rights)
        {
            if (!Directory.Exists(directory)) Fail("workspace directory does not exist: " + directory);
            var info = new DirectoryInfo(directory);
            var ac = info.GetAccessControl();
            if (HasRights(ac, sid, rights)) return; // idempotent: standing ACE stays, no re-propagation
            var rule = new FileSystemAccessRule(
                sid, rights,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None, AccessControlType.Allow);
            ac.AddAccessRule(rule);
            info.SetAccessControl(ac);
        }

        // ── 主流程 ─────────────────────────────────────────────────────────
        const string CONTAINER_NAME = "dsh-perm-gate.ac";

        /// Resolve the OS-derived AppContainer SID for the plugin's fixed
        /// container name. Self-made S-1-15-2 SIDs are rejected by
        /// NtCreateLowBoxToken with STATUS_INVALID_SID — the SID must come
        /// from the OS derivation. Two eras of the API exist, both in
        /// KernelBase with the same (PCWSTR, out PSID) → HRESULT shape:
        ///   - DeriveAppContainerSidFromAppContainerName (Win8 … 24H2),
        ///   - AppContainerDeriveSidFromMoniker (26H1/25H2+ mxc builds,
        ///     where the classic export is GONE — verified on 26200).
        /// Resolved dynamically so one binary runs on both.
        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Ansi)]
        static extern IntPtr GetProcAddress(IntPtr module, string name);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern IntPtr LoadLibraryW(string name);

        delegate long DeriveSidDelegate(string name, out IntPtr sid);

        static string ContainerSidString()
        {
            var module = LoadLibraryW("KernelBase.dll");
            if (module == IntPtr.Zero) Fail("LoadLibrary(KernelBase) failed");
            IntPtr proc = GetProcAddress(module, "DeriveAppContainerSidFromAppContainerName");
            if (proc == IntPtr.Zero) proc = GetProcAddress(module, "AppContainerDeriveSidFromMoniker");
            if (proc == IntPtr.Zero) Fail("no AppContainer SID derivation export on this OS (tried classic + moniker)");
            var derive = (DeriveSidDelegate)Marshal.GetDelegateForFunctionPointer(proc, typeof(DeriveSidDelegate));
            IntPtr sid;
            long hr = derive(CONTAINER_NAME, out sid);
            if (hr != 0) Fail("AppContainer SID derivation failed (HRESULT 0x" + hr.ToString("X8") + ")");
            IntPtr stringSid;
            if (ConvertSidToStringSidW(sid, out stringSid) == 0)
                Fail("ConvertSidToStringSidW failed (win32 " + Marshal.GetLastWin32Error() + ")");
            var text = Marshal.PtrToStringUni(stringSid);
            LocalFree(stringSid);
            LocalFree(sid);
            if (text == null) Fail("container SID is empty");
            return text;
        }

        static int Main(string[] args)
        {
            // --print-sid: emit the OS-derived container SID and exit — the
            // Node side uses it for the one-time loopback exemption.
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--print-sid")
                {
                    Console.Out.WriteLine(ContainerSidString());
                    return 0;
                }
            }

            string configPath = null;
            string encoded = null;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--config" && i + 1 < args.Length) { configPath = args[i + 1]; i++; }
                else if (args[i] == "--exec-b64" && i + 1 < args.Length) { encoded = args[i + 1]; i++; }
            }
            if (configPath == null || encoded == null) Fail("usage: launcher [--print-sid] | --config <file> --exec-b64 <base64>");

            IDictionary<string, object> cfg;
            try
            {
                var serializer = new JavaScriptSerializer();
                cfg = serializer.Deserialize<IDictionary<string, object>>(File.ReadAllText(configPath));
            }
            catch (Exception e) { Fail("cannot read launch config: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            var workspace = AsString(cfg, "workspace");
            var tempDir = AsString(cfg, "tempDir");
            var mode = AsString(cfg, "mode");
            if (workspace == null || tempDir == null) Fail("launch config missing workspace/tempDir");

            SecurityIdentifier containerSid;
            try { containerSid = new SecurityIdentifier(ContainerSidString()); }
            catch (Exception e) { Fail("bad container SID: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            string command;
            try { command = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(encoded)); }
            catch (Exception e) { Fail("bad --exec-b64 payload: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            // 1. ACL：容器 SID 默认零访问；系统目录靠 ALL APPLICATION PACKAGES
            //    默认 ACE，工作区与临时目录在此显式开。幂等：已有等价规则不重写。
            try
            {
                Directory.CreateDirectory(tempDir);
                GrantTree(workspace, containerSid, FileSystemRights.ReadAndExecute);
                GrantTree(tempDir, containerSid, FileSystemRights.FullControl);
                if (mode == "workspace-write") GrantTree(workspace, containerSid, FileSystemRights.Modify | FileSystemRights.ExecuteFile);
            }
            catch (Exception e) { Fail("ACL grant failed: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            // 2. 自身环境改造后继承：TMP/TEMP 指向私有临时目录，代理变量逐条写入。
            try
            {
                Environment.SetEnvironmentVariable("TMP", tempDir, EnvironmentVariableTarget.Process);
                Environment.SetEnvironmentVariable("TEMP", tempDir, EnvironmentVariableTarget.Process);
                var proxyEnv = cfg["proxyEnv"] as IDictionary<string, object>;
                if (proxyEnv != null)
                {
                    foreach (KeyValuePair<string, object> kv in proxyEnv)
                    {
                        var value = kv.Value == null ? null : kv.Value.ToString();
                        Environment.SetEnvironmentVariable(kv.Key, value, EnvironmentVariableTarget.Process);
                    }
                }
            }
            catch (Exception e) { Fail("environment override failed: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            // 3. 容器 SID 二进制 + 零能力属性表：kernel 侧自建 AppContainer
            //    token；没有 internetClient 等任何能力 → 非回环出网在 WFP 层被拒。
            IntPtr sidPtr = Marshal.AllocHGlobal(containerSid.BinaryLength);
            var sidBytes = new byte[containerSid.BinaryLength];
            containerSid.GetBinaryForm(sidBytes, 0);
            Marshal.Copy(sidBytes, 0, sidPtr, sidBytes.Length);

            var secCaps = new SECURITY_CAPABILITIES();
            secCaps.AppContainerSid = sidPtr;
            secCaps.CapabilityCount = 0;
            secCaps.Capabilities = IntPtr.Zero;
            IntPtr attrSize = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attrSize);
            var attrList = Marshal.AllocHGlobal(attrSize);
            if (!InitializeProcThreadAttributeList(attrList, 1, 0, ref attrSize))
                Fail("InitializeProcThreadAttributeList failed (win32 " + Marshal.GetLastWin32Error() + ")");
            var secCapsPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SECURITY_CAPABILITIES)));
            Marshal.StructureToPtr(secCaps, secCapsPtr, false);
            if (!UpdateProcThreadAttribute(attrList, 0, (IntPtr)PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
                    secCapsPtr, (UIntPtr)Marshal.SizeOf(typeof(SECURITY_CAPABILITIES)), IntPtr.Zero, IntPtr.Zero))
                Fail("UpdateProcThreadAttribute failed (win32 " + Marshal.GetLastWin32Error() + ")");

            // 4. kill-on-close Job：启动器死 → 子进程树陪葬。
            var job = CreateJobObjectW(IntPtr.Zero, null);
            if (job == IntPtr.Zero) Fail("CreateJobObjectW failed (win32 " + Marshal.GetLastWin32Error() + ")");
            var limit = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limit.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            var limitPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION)));
            Marshal.StructureToPtr(limit, limitPtr, false);
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, limitPtr, (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION))))
                Fail("SetInformationJobObject failed (win32 " + Marshal.GetLastWin32Error() + ")");

            // 5. 容器内执行：cmd /d /s /c "<命令>"。/s 让 cmd 整体剥最外层引号、
            //    其余引号原样保留；stdio 继承启动器的（管道/控制台皆可）。
            var comspec = Path.Combine(Environment.SystemDirectory, "cmd.exe");
            var cmdline = "\"" + comspec + "\" /d /s /c \"" + command + "\"";
            var siex = new STARTUPINFOEXW();
            siex.StartupInfo.cb = (uint)Marshal.SizeOf(typeof(STARTUPINFOEXW));
            siex.lpAttributeList = attrList;
            siex.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
            siex.StartupInfo.hStdInput = GetStdHandleChecked(-10);
            siex.StartupInfo.hStdOutput = GetStdHandleChecked(-11);
            siex.StartupInfo.hStdError = GetStdHandleChecked(-12);

            PROCESS_INFORMATION pi;
            if (!CreateProcessW(comspec, cmdline, IntPtr.Zero, IntPtr.Zero, true,
                    EXTENDED_STARTUPINFO_PRESENT, IntPtr.Zero, workspace, siex, out pi))
            {
                var err = Marshal.GetLastWin32Error();
                Fail("CreateProcessW(SECURITY_CAPABILITIES) failed (win32 " + err + ")");
            }
            AssignProcessToJobObject(job, pi.hProcess);

            if (WaitForSingleObject(pi.hProcess, 0xFFFFFFFF) != 0)
                Fail("WaitForSingleObject failed");
            uint exitCode;
            if (!GetExitCodeProcess(pi.hProcess, out exitCode))
                Fail("GetExitCodeProcess failed (win32 " + Marshal.GetLastWin32Error() + ")");
            DeleteProcThreadAttributeList(attrList);
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            Marshal.FreeHGlobal(secCapsPtr);
            Marshal.FreeHGlobal(attrList);
            Marshal.FreeHGlobal(sidPtr);
            CloseHandle(job);
            return unchecked((int)exitCode);
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GetStdHandle(int handle);

        static IntPtr GetStdHandleChecked(int which)
        {
            var h = GetStdHandle(which);
            if (h != IntPtr.Zero && h != new IntPtr(-1)) SetHandleInformation(h, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
            return h;
        }

        static string AsString(IDictionary<string, object> cfg, string key)
        {
            object v;
            return cfg.TryGetValue(key, out v) && v != null ? v.ToString() : null;
        }
    }
}
