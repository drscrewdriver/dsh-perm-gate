/**
 * appcontainer-launcher.cs — dsh-perm-gate 的 Windows AppContainer 启动器。
 *
 * 职责（单一）：把一条 shell 命令放进 AppContainer 里执行——
 *   1. 对 workspace / temp 做幂等 ACE 授予（容器 SID 默认零环境访问，系统目录
 *      靠 ALL APPLICATION PACKAGES 默认 ACE，工作区必须显式开）；
 *   2. 容器 SID 由 OS 派生（Region B 三级解析链：apiset→classic→moniker；
 *      自造 S-1-15-2 SID 一律被内核 STATUS_INVALID_SID 拒收）；随后走官方
 *      属性列表路径（PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES +
 *      CreateProcessW），**能力清单为空** → WFP 层直接封死全部非回环出网，
 *      回环经 CheckNetIsolation 豁免放行，出网只能走注入的本地过滤代理；
 *   3. cmd.exe /d /s /c "<解码后命令>" 在容器内执行，stdio 继承、退出码透传；
 *   4. 挂 kill-on-close Job，启动器被杀则整棵子进程树陪葬。
 *
 * 动词（Region E 分发）：
 *   --print-sid                 stdout 单行容器 SID（Node 侧依赖，协议冻结）
 *   --probe                     stdout 单行 JSON 裁决（恒 exit 0；仅诊断归因用，
 *                               绝非放行依据——逐 launch 解析才是信任锚）
 *   --register [--sig N]        显式注册动词（AppContainerRegisterSid 签名未
 *                               公开，候选表试错打印 hr；主流程绝不调用）
 *   --unregister [--sig N]      镜像清理（hunt 试错后的恢复路径）
 *   --config <f> --exec-b64 <b64>  执行（契约不变）
 *
 * 环境继承形态（windows-acl 验证过的）：启动器先改**自身**进程环境
 * （TMP/TEMP/代理变量），CreateProcessW 传 NULL env block 让子进程继承
 * ——不碰显式 env block 封送（同族代码在该路径上翻过车）。
 *
 * 约定：启动失败一律 stderr 打 `dsh-perm-gate-appcontainer: <code>: <msg>`
 * 并以 125 退出（runner-failure 签名，供门控结果审计归因）；命令本身的失败
 * 按子进程退出码原样透传。探针例外：--probe 任何子项失败都进 JSON、恒 exit 0。
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

namespace DshPermGate
{
    internal static class Launcher
    {
        const int EXIT_LAUNCH_FAILURE = 125;
        const string SIGNATURE = "dsh-perm-gate-appcontainer: ";
        const string CONTAINER_NAME = "dsh-perm-gate.ac";

        // ── Win32 ──────────────────────────────────────────────────────────
        const uint JobObjectExtendedLimitInformation = 9;
        const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
        const uint STARTF_USESTDHANDLES = 0x0100;
        const uint HANDLE_FLAG_INHERIT = 0x1;
        // 容器内启动统一走官方属性列表路径（kernel 侧自建 token）：
        // PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES + CreateProcessW。
        const uint PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES = 0x00020009;
        const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;

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
        struct STARTUPINFOEXW
        {
            public STARTUPINFOW StartupInfo;
            public IntPtr lpAttributeList;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct SECURITY_CAPABILITIES
        {
            public IntPtr Capabilities;      // PSID_AND_ATTRIBUTES (zero = no capabilities)
            public uint CapabilityCount;
            public IntPtr AppContainerSid;   // PSID
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

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern void DeleteProcThreadAttributeList(IntPtr list);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool UpdateProcThreadAttribute(
            IntPtr list, uint flags, IntPtr attribute, IntPtr value, UIntPtr size, IntPtr prevValue, IntPtr returnValue);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool CreateProcessW(
            string lpApplicationName, string lpCommandLine,
            IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles,
            uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory,
            STARTUPINFOEXW lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GetStdHandle(int handle);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        static extern long ConvertSidToStringSidW(IntPtr sid, out IntPtr stringSid);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr LocalFree(IntPtr handle);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Ansi)]
        static extern IntPtr GetProcAddress(IntPtr module, string name);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern IntPtr LoadLibraryW(string name);

        static void Fail(string code, string message)
        {
            Console.Error.WriteLine(SIGNATURE + code + ": " + message);
            Environment.Exit(EXIT_LAUNCH_FAILURE);
        }

        // ══ Region B: DerivationBackend（两代分叉的唯一区段） ═══════════════
        // 判据：grep 全文件，"DeriveAppContainerSid|Moniker" 字样只许出现在
        // 本 Region。三级解析链序固定：apiset（≤24H2 契约面）→ KernelBase
        // 经典名 → moniker 名（KernelBase → kernel.appcore）。lookup/register/
        // unregister/createToken 一律从**同一命中模块**解析（单 provider，
        // 防混搭 ABI）。

        /// apiset 契约模块（经典函数的官方稳定面；26200 上已无这些 DLL，
        /// 逐个 LoadLibrary 落空即瞬间进下一级——尽力而为，绝不致命）。
        static readonly string[] ApiSetModules = new string[] {
            "api-ms-win-appmodel-runtime-l1-1-5.dll",
            "api-ms-win-appmodel-runtime-l1-1-4.dll",
            "api-ms-win-appmodel-runtime-l1-1-3.dll",
            "api-ms-win-appmodel-runtime-l1-1-2.dll",
            "api-ms-win-appmodel-runtime-l1-1-1.dll",
            "api-ms-win-appmodel-runtime-l1-1-0.dll",
        };
        /// 经典派生导出名（注意：MS 文档别名 "DeriveAppContainerSidFromName"
        /// 不是导出名；导出名带 AppContainerName 后缀，EntryPoint 显式）。
        const string ClassicDeriveExport = "DeriveAppContainerSidFromAppContainerName";
        const string MonikerDeriveExport = "AppContainerDeriveSidFromMoniker";
        const string LookupExport = "AppContainerLookupMoniker";
        const string RegisterExport = "AppContainerRegisterSid";
        const string UnregisterExport = "AppContainerUnregisterSid";
        const string CreateTokenExport = "CreateAppContainerToken";

        /// One resolved provider: everything era-specific lives here.
        struct Backend
        {
            public string Era;            // "classic" | "moniker" | "none"
            public string ModuleName;     // provider module file name
            public string DeriveName;     // derive export name (for diagnostics)
            public IntPtr Derive;         // (PCWSTR, out PSID) → HRESULT
            public IntPtr Lookup;         // AppContainerLookupMoniker（可缺失）
            public IntPtr Register;       // AppContainerRegisterSid（可缺失）
            public IntPtr Unregister;     // AppContainerUnregisterSid（可缺失）
            public IntPtr CreateToken;    // CreateAppContainerToken（可缺失）
        }

        delegate long DeriveDelegate(string name, out IntPtr sid);
        delegate long LookupDelegate(IntPtr sid, out IntPtr monikerPtr);

        /// 注册签名候选表（AppContainerRegisterSid 无公开文档；hunt 协议逐个
        /// 试错，判据三连 = hr==0 → Mappings 新增键 → 试启动 87 消失）。
        /// --sig N 选择候选（默认 0）；崩溃/异常按该候选失败记录，换 N 重试。
        delegate long RegisterSig0(IntPtr sid, string moniker);
        delegate long RegisterSig1(string moniker, IntPtr sid);
        delegate long RegisterSig2(string moniker, IntPtr sid, uint flags);
        delegate long RegisterSig3(IntPtr sid, string moniker, string displayName);
        const int RegisterSigCount = 4;

        delegate long UnregisterSig0(IntPtr sid);
        delegate long UnregisterSig1(string moniker);
        delegate long UnregisterSig2(IntPtr sid, string moniker);
        const int UnregisterSigCount = 3;

        /// CreateAppContainerToken 候选形（仅探针用：不建进程判 SID 可用性，
        /// 把「注册失败」与「token 拒收」切开；启动路径绝不经过它）。
        delegate long CreateTokenDelegate(IntPtr sid, uint capabilityCount, IntPtr capabilities, out IntPtr token);

        static Backend ResolveBackend()
        {
            var b = new Backend();
            // Level-0: apiset 契约模块 + 经典名
            foreach (var apiSet in ApiSetModules)
            {
                var m = LoadLibraryW(apiSet);
                if (m == IntPtr.Zero) continue;
                var p = GetProcAddress(m, ClassicDeriveExport);
                if (p != IntPtr.Zero) return BuildBackend(m, apiSet, p, "classic", ClassicDeriveExport);
            }
            var kb = LoadLibraryW("KernelBase.dll");
            if (kb != IntPtr.Zero)
            {
                // Level-1: KernelBase 经典名（Win8…24H2 的宿主）
                var classic = GetProcAddress(kb, ClassicDeriveExport);
                if (classic != IntPtr.Zero) return BuildBackend(kb, "KernelBase.dll", classic, "classic", ClassicDeriveExport);
                // Level-2: moniker 名（25H2+ 新代；经典导出已消失）
                var moniker = GetProcAddress(kb, MonikerDeriveExport);
                if (moniker != IntPtr.Zero) return BuildBackend(kb, "KernelBase.dll", moniker, "moniker", MonikerDeriveExport);
            }
            var kac = LoadLibraryW("kernel.appcore.dll");
            if (kac != IntPtr.Zero)
            {
                var moniker2 = GetProcAddress(kac, MonikerDeriveExport);
                if (moniker2 != IntPtr.Zero) return BuildBackend(kac, "kernel.appcore.dll", moniker2, "moniker", MonikerDeriveExport);
            }
            return b; // Era == null → 调用方视为 "none"
        }

        static Backend BuildBackend(IntPtr module, string moduleName, IntPtr derive, string era, string deriveName)
        {
            var b = new Backend();
            b.Era = era;
            b.ModuleName = moduleName;
            b.DeriveName = deriveName;
            b.Derive = derive;
            b.Lookup = GetProcAddress(module, LookupExport);
            b.Register = GetProcAddress(module, RegisterExport);
            b.Unregister = GetProcAddress(module, UnregisterExport);
            b.CreateToken = GetProcAddress(module, CreateTokenExport);
            return b;
        }

        /// era 无关的派生调用（两代共用 (PCWSTR, out PSID)→HRESULT 形）。
        static long CallDerive(Backend b, out IntPtr sid)
        {
            var fn = (DeriveDelegate)Marshal.GetDelegateForFunctionPointer(b.Derive, typeof(DeriveDelegate));
            return fn(CONTAINER_NAME, out sid);
        }

        // ══ Region C: ACL + env（era 中立） ════════════════════════════════

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
            if (!Directory.Exists(directory)) throw new IOException("directory does not exist: " + directory);
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

        // ══ Region D: 属性列表启动（唯一启动路径，era 中立） ══════════════

        struct LaunchOutcome
        {
            public bool Started;        // CreateProcessW succeeded
            public int Win32Err;        // CreateProcessW 层错误码（87/4250/5/2…）
            public int ChildExit;       // 子进程退出码（Started 时有效）
        }

        /// 完整启动路径：ACL → env 自改继承 → 属性表（零能力）→ cmd /d /s /c。
        /// 探针与 exec 共用；探针传哨兵命令与一次性目录。
        static LaunchOutcome TryLaunch(SecurityIdentifier containerSid, string workspace, string tempDir,
            string mode, IDictionary<string, string> proxyEnv, string command)
        {
            var outcome = new LaunchOutcome();
            outcome.Started = false;
            outcome.Win32Err = 0;
            outcome.ChildExit = -1;
            try
            {
                Directory.CreateDirectory(tempDir);
                GrantTree(workspace, containerSid, FileSystemRights.ReadAndExecute);
                GrantTree(tempDir, containerSid, FileSystemRights.FullControl);
                if (mode == "workspace-write") GrantTree(workspace, containerSid, FileSystemRights.Modify | FileSystemRights.ExecuteFile);
            }
            catch (Exception) { outcome.Win32Err = 5; return outcome; } // ACL 面失败：按拒绝访问归因

            try
            {
                Environment.SetEnvironmentVariable("TMP", tempDir, EnvironmentVariableTarget.Process);
                Environment.SetEnvironmentVariable("TEMP", tempDir, EnvironmentVariableTarget.Process);
                if (proxyEnv != null)
                {
                    foreach (KeyValuePair<string, string> kv in proxyEnv)
                        Environment.SetEnvironmentVariable(kv.Key, kv.Value, EnvironmentVariableTarget.Process);
                }
            }
            catch (Exception) { outcome.Win32Err = 5; return outcome; }

            // 容器 SID 二进制 + 零能力属性表：kernel 侧自建 AppContainer token。
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
            {
                outcome.Win32Err = Marshal.GetLastWin32Error();
                Marshal.FreeHGlobal(attrList); Marshal.FreeHGlobal(sidPtr);
                return outcome;
            }
            var secCapsPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SECURITY_CAPABILITIES)));
            Marshal.StructureToPtr(secCaps, secCapsPtr, false);
            if (!UpdateProcThreadAttribute(attrList, 0, (IntPtr)PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
                    secCapsPtr, (UIntPtr)Marshal.SizeOf(typeof(SECURITY_CAPABILITIES)), IntPtr.Zero, IntPtr.Zero))
            {
                outcome.Win32Err = Marshal.GetLastWin32Error();
                DeleteProcThreadAttributeList(attrList);
                Marshal.FreeHGlobal(secCapsPtr); Marshal.FreeHGlobal(attrList); Marshal.FreeHGlobal(sidPtr);
                return outcome;
            }

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
                outcome.Win32Err = Marshal.GetLastWin32Error();
                DeleteProcThreadAttributeList(attrList);
                Marshal.FreeHGlobal(secCapsPtr); Marshal.FreeHGlobal(attrList); Marshal.FreeHGlobal(sidPtr);
                return outcome;
            }
            AssignProcessToJobObject(jobHandle, pi.hProcess);

            if (WaitForSingleObject(pi.hProcess, 0xFFFFFFFF) != 0)
            {
                outcome.Win32Err = Marshal.GetLastWin32Error();
                DeleteProcThreadAttributeList(attrList);
                Marshal.FreeHGlobal(secCapsPtr); Marshal.FreeHGlobal(attrList); Marshal.FreeHGlobal(sidPtr);
                return outcome;
            }
            uint exitCode;
            if (!GetExitCodeProcess(pi.hProcess, out exitCode)) outcome.Win32Err = Marshal.GetLastWin32Error();
            else outcome.ChildExit = unchecked((int)exitCode);
            outcome.Started = true;
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            DeleteProcThreadAttributeList(attrList);
            Marshal.FreeHGlobal(secCapsPtr); Marshal.FreeHGlobal(attrList); Marshal.FreeHGlobal(sidPtr);
            return outcome;
        }

        static IntPtr jobHandle = IntPtr.Zero; // exec 主流程的 kill-on-close Job
        static IntPtr GetStdHandleChecked(int which)
        {
            var h = GetStdHandle(which);
            if (h != IntPtr.Zero && h != new IntPtr(-1)) SetHandleInformation(h, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
            return h;
        }

        static string SidToString(IntPtr sid)
        {
            IntPtr stringSid;
            if (ConvertSidToStringSidW(sid, out stringSid) == 0) return null;
            var text = Marshal.PtrToStringUni(stringSid);
            LocalFree(stringSid);
            return text;
        }

        // ══ Region E: 动词分发 ═════════════════════════════════════════════

        static int Main(string[] args)
        {
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--print-sid") return VerbPrintSid();
                if (args[i] == "--probe") return VerbProbe();
                if (args[i] == "--register") return VerbRegister(args, i + 1 < args.Length && args[i + 1] == "--sig" ? IntArg(args, i + 2) : 0);
                if (args[i] == "--unregister") return VerbUnregister(args, i + 1 < args.Length && args[i + 1] == "--sig" ? IntArg(args, i + 2) : 0);
            }
            return VerbExec(args);
        }

        static int IntArg(string[] args, int index)
        {
            if (index >= args.Length) return 0;
            int v; return int.TryParse(args[index], out v) ? v : 0;
        }

        /// --print-sid：协议冻结（Node 侧 launcherSid 依赖 stdout 单行 SID）。
        static int VerbPrintSid()
        {
            var backend = ResolveBackend();
            if (backend.Era == null) Fail("no-backend", "no AppContainer SID derivation export on this OS (tried apiset×N, classic, moniker)");
            IntPtr sid;
            var hr = CallDerive(backend, out sid);
            if (hr != 0) Fail("derive-failed", "derive via " + backend.DeriveName + "(" + backend.ModuleName + ") failed 0x" + hr.ToString("X8"));
            var text = SidToString(sid);
            LocalFree(sid);
            if (text == null) Fail("sid-tostring-failed", "ConvertSidToStringSidW failed");
            Console.Out.WriteLine(text);
            return 0;
        }

        /// --register / --unregister：hunt 协议专用。逐候选绑定调用并打印 hr；
        /// 错误候选可能使本进程崩溃（可接受——探针边界内，换 --sig 重试）。
        static int VerbRegister(string[] args, int sig)
        {
            var backend = ResolveBackend();
            if (backend.Era == null || backend.Register == IntPtr.Zero) Fail("no-backend", "no register export (era=" + (backend.Era ?? "none") + ")");
            IntPtr sid;
            var hr = CallDerive(backend, out sid);
            if (hr != 0) Fail("derive-failed", "derive failed 0x" + hr.ToString("X8"));
            long result;
            if (sig == 0) result = ((RegisterSig0)Marshal.GetDelegateForFunctionPointer(backend.Register, typeof(RegisterSig0)))(sid, CONTAINER_NAME);
            else if (sig == 1) result = ((RegisterSig1)Marshal.GetDelegateForFunctionPointer(backend.Register, typeof(RegisterSig1)))(CONTAINER_NAME, sid);
            else if (sig == 2) result = ((RegisterSig2)Marshal.GetDelegateForFunctionPointer(backend.Register, typeof(RegisterSig2)))(CONTAINER_NAME, sid, 0);
            else result = ((RegisterSig3)Marshal.GetDelegateForFunctionPointer(backend.Register, typeof(RegisterSig3)))(sid, CONTAINER_NAME, "DSH perm-gate AppContainer");
            Console.Out.WriteLine("register sig=" + sig + " hr=0x" + result.ToString("X8"));
            Console.Out.WriteLine("sid=" + SidToString(sid));
            return 0;
        }

        static int VerbUnregister(string[] args, int sig)
        {
            var backend = ResolveBackend();
            if (backend.Era == null || backend.Unregister == IntPtr.Zero) Fail("no-backend", "no unregister export (era=" + (backend.Era ?? "none") + ")");
            IntPtr sid;
            var hr = CallDerive(backend, out sid);
            if (hr != 0) Fail("derive-failed", "derive failed 0x" + hr.ToString("X8"));
            long result;
            if (sig == 0) result = ((UnregisterSig0)Marshal.GetDelegateForFunctionPointer(backend.Unregister, typeof(UnregisterSig0)))(sid);
            else if (sig == 1) result = ((UnregisterSig1)Marshal.GetDelegateForFunctionPointer(backend.Unregister, typeof(UnregisterSig1)))(CONTAINER_NAME);
            else result = ((UnregisterSig2)Marshal.GetDelegateForFunctionPointer(backend.Unregister, typeof(UnregisterSig2)))(sid, CONTAINER_NAME);
            Console.Out.WriteLine("unregister sig=" + sig + " hr=0x" + result.ToString("X8"));
            return 0;
        }

        /// --probe：单行 JSON 裁决，恒 exit 0。tryLaunch 复用完整启动路径
        /// （一次性工作区 + 哨兵命令 exit 42），区分 CreateProcessW 层错误与
        /// 子进程真实退出码。
        static int VerbProbe()
        {
            var probe = new Dictionary<string, string>();
            var backend = ResolveBackend();
            var era = backend.Era ?? "none";
            var deriveHr = "0x0";
            var sidText = "";
            var subAuthorities = 0;
            var lookupState = "n/a";
            var lookupHr = "0x0";
            var capabilities = new Dictionary<string, bool>();
            capabilities["lookup"] = backend.Lookup != IntPtr.Zero;
            capabilities["register"] = backend.Register != IntPtr.Zero;
            capabilities["unregister"] = backend.Unregister != IntPtr.Zero;
            capabilities["createToken"] = backend.CreateToken != IntPtr.Zero;
            var win32Err = 0;
            var childExit = -1;
            var attempted = false;

            if (backend.Era == null)
            {
                deriveHr = "0xFFFFFFFF";
            }
            else
            {
                IntPtr sid;
                var hr = CallDerive(backend, out sid);
                deriveHr = "0x" + hr.ToString("X8");
                if (hr == 0)
                {
                    sidText = SidToString(sid) ?? "";
                    if (sidText != "")
                    {
                        var raw = new byte[new SecurityIdentifier(sidText).BinaryLength];
                        new SecurityIdentifier(sidText).GetBinaryForm(raw, 0);
                        subAuthorities = raw[1];
                    }
                    // LookupMoniker / CreateAppContainerToken 的签名均未公开确认
                    // （LookupMoniker 错误形状已在实测中 AV 掉探针进程）——v1 只
                    // 报告导出存在性，不做调用；确认签名前「注册态」恒 n/a，
                    // tryLaunch 的 win32Err 是唯一行为信号。hunt 见 --register。
                    // tryLaunch：完整路径 + 哨兵命令。探针工作区独立、只读模式。
                    var probeWs = Path.Combine(Path.GetTempPath(), "dsh-pg-ac-probe-" + Guid.NewGuid().ToString("N"));
                    attempted = true;
                    var outcome = TryLaunch(new SecurityIdentifier(sidText), probeWs, probeWs, "read-only", null, "exit 42");
                    win32Err = outcome.Win32Err;
                    childExit = outcome.ChildExit;
                    try { Directory.Delete(probeWs, true); } catch (Exception) { }
                }
            }

            // Environment.OSVersion 在 .NET Framework 下按兼容清单撒谎（本机报
            // 9200/Win8）——真 build 从注册表读（CurrentBuild + UBR）。
            var osBuild = ReadRealOsBuild();
            var sb = new System.Text.StringBuilder();
            sb.Append("{");
            sb.Append("\"era\":\"" + era + "\",");
            sb.Append("\"derive\":{\"name\":\"" + backend.DeriveName + "\",\"module\":\"" + backend.ModuleName + "\",\"hr\":\"" + deriveHr + "\"},");
            sb.Append("\"sid\":\"" + sidText + "\",");
            sb.Append("\"sidSubAuthorities\":" + subAuthorities + ",");
            sb.Append("\"registered\":{\"state\":\"" + lookupState + "\",\"lookupHr\":\"" + lookupHr + "\",\"mappingMoniker\":null},");
            sb.Append("\"tryLaunch\":{\"attempted\":" + (attempted ? "true" : "false") + ",\"win32Err\":" + win32Err + ",\"childExit\":" + (childExit == -1 ? "null" : childExit.ToString()) + "},");
            sb.Append("\"osBuild\":" + osBuild + ",");
            sb.Append("\"capabilities\":{");
            var first = true;
            foreach (KeyValuePair<string, bool> kv in capabilities)
            {
                if (!first) sb.Append(",");
                first = false;
                sb.Append("\"" + kv.Key + "\":" + (kv.Value ? "true" : "false"));
            }
            sb.Append("},");
            sb.Append("\"mxc\":{\"present\":" + (File.Exists(Path.Combine(Environment.SystemDirectory, "processmodel.dll")) ? "true" : "false") + "}");
            sb.Append("}");
            Console.Out.WriteLine(sb.ToString());
            return 0;
        }

        /// --config + --exec-b64：执行主路径（契约不变；config 的 allowRegister
        /// 字段为 hunt 定案前的预留位，本版本恒不读）。
        static int VerbExec(string[] args)
        {
            string configPath = null;
            string encoded = null;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--config" && i + 1 < args.Length) { configPath = args[i + 1]; i++; }
                else if (args[i] == "--exec-b64" && i + 1 < args.Length) { encoded = args[i + 1]; i++; }
            }
            if (configPath == null || encoded == null) Fail("usage", "usage: launcher [--print-sid | --probe | --register] | --config <file> --exec-b64 <base64>");

            IDictionary<string, object> cfg;
            try
            {
                var serializer = new System.Web.Script.Serialization.JavaScriptSerializer();
                cfg = serializer.Deserialize<IDictionary<string, object>>(File.ReadAllText(configPath));
            }
            catch (Exception e) { Fail("config-read", "cannot read launch config: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            var workspace = AsString(cfg, "workspace");
            var tempDir = AsString(cfg, "tempDir");
            var mode = AsString(cfg, "mode");
            if (workspace == null || tempDir == null) Fail("config-shape", "launch config missing workspace/tempDir");

            var backend = ResolveBackend();
            if (backend.Era == null) Fail("no-backend", "no AppContainer SID derivation export on this OS (tried apiset×N, classic, moniker)");
            IntPtr sid;
            var hr = CallDerive(backend, out sid);
            if (hr != 0) Fail("derive-failed", "derive via " + backend.DeriveName + "(" + backend.ModuleName + ") failed 0x" + hr.ToString("X8"));
            var sidText = SidToString(sid);
            if (sidText == null) Fail("sid-tostring-failed", "ConvertSidToStringSidW failed");
            SecurityIdentifier containerSid;
            try { containerSid = new SecurityIdentifier(sidText); }
            catch (Exception e) { Fail("sid-parse", "bad container SID: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            string command;
            try { command = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(encoded)); }
            catch (Exception e) { Fail("payload", "bad --exec-b64 payload: " + e.Message); return EXIT_LAUNCH_FAILURE; }

            // kill-on-close Job：启动器死 → 子进程树陪葬。
            jobHandle = CreateJobObjectW(IntPtr.Zero, null);
            if (jobHandle == IntPtr.Zero) Fail("job-create", "CreateJobObjectW failed (win32 " + Marshal.GetLastWin32Error() + ")");
            var limit = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limit.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            var limitPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION)));
            Marshal.StructureToPtr(limit, limitPtr, false);
            if (!SetInformationJobObject(jobHandle, JobObjectExtendedLimitInformation, limitPtr, (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION))))
                Fail("job-config", "SetInformationJobObject failed (win32 " + Marshal.GetLastWin32Error() + ")");

            var proxyEnv = new Dictionary<string, string>();
            var rawEnv = cfg["proxyEnv"] as IDictionary<string, object>;
            if (rawEnv != null)
            {
                foreach (KeyValuePair<string, object> kv in rawEnv)
                    proxyEnv[kv.Key] = kv.Value == null ? null : kv.Value.ToString();
            }

            var outcome = TryLaunch(containerSid, workspace, tempDir, mode, proxyEnv, command);
            if (!outcome.Started)
                Fail("launch-failed", "CreateProcessW(SECURITY_CAPABILITIES) failed (win32 " + outcome.Win32Err + ")");
            CloseHandle(jobHandle);
            return outcome.ChildExit;
        }

        static string AsString(IDictionary<string, object> cfg, string key)
        {
            object v;
            return cfg.TryGetValue(key, out v) && v != null ? v.ToString() : null;
        }

        /// Real OS build number（HKLM CurrentBuild；Environment.OSVersion 会按
        /// 兼容清单返回假值——本机实测报 9200）。
        static int ReadRealOsBuild()
        {
            try
            {
                var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
                if (key == null) return Environment.OSVersion.Version.Build;
                return Convert.ToInt32(key.GetValue("CurrentBuild", Environment.OSVersion.Version.Build));
            }
            catch (Exception) { return Environment.OSVersion.Version.Build; }
        }
    }
}
