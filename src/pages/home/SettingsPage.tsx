import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Database,
  EyeOff,
  KeyRound,
  RefreshCw,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import {
  loadManagerWorkspaceSettings,
  resetManagerWorkspaceSettings,
  saveManagerWorkspaceSettings,
  type ManagerWorkspaceSettings,
} from "@/lib/app-settings";

export function SettingsPage() {
  const { user } = useAuth();
  const userDepartment =
    user && "department" in user && typeof user.department === "string"
      ? user.department
      : "";
  const [workspaceSettings, setWorkspaceSettings] = useState<ManagerWorkspaceSettings>({
    recognitionHighQuality: false,
  });
  const [isEditingKimiApiKey, setIsEditingKimiApiKey] = useState(false);
  const [kimiApiKeyInput, setKimiApiKeyInput] = useState("");
  const [saveState, setSaveState] = useState<"" | "saved">("");
  const [securityMessage, setSecurityMessage] = useState("");
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: aiSecurityConfig } = trpc.systemSettings.getAiSecurityConfig.useQuery(undefined, {
    enabled: isAdmin,
  });
  const setKimiApiKeyMutation = trpc.systemSettings.setKimiApiKey.useMutation({
    onSuccess: async () => {
      setIsEditingKimiApiKey(false);
      setKimiApiKeyInput("");
      setSecurityMessage("Kimi API Key 已加密保存到服务端。");
      showSaved();
      await utils.systemSettings.getAiSecurityConfig.invalidate();
    },
  });
  const clearKimiApiKeyMutation = trpc.systemSettings.clearKimiApiKey.useMutation({
    onSuccess: async () => {
      setIsEditingKimiApiKey(false);
      setKimiApiKeyInput("");
      setSecurityMessage("已清除服务端保存的 Kimi API Key。");
      showSaved();
      await utils.systemSettings.getAiSecurityConfig.invalidate();
    },
  });

  useEffect(() => {
    setWorkspaceSettings(loadManagerWorkspaceSettings());
  }, []);

  const loginSource = "当前会话";

  const showSaved = () => {
    setSaveState("saved");
    window.setTimeout(() => setSaveState(""), 1200);
  };

  const saveWorkspaceSettings = (nextSettings: ManagerWorkspaceSettings) => {
    setWorkspaceSettings(nextSettings);
    saveManagerWorkspaceSettings(nextSettings);
    showSaved();
  };

  const handleResetWorkspace = () => {
    resetManagerWorkspaceSettings();
    setWorkspaceSettings(loadManagerWorkspaceSettings());
  };

  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">设置中心</h1>
            <p className="text-xs text-gray-500">统一管理识别服务、本地缓存和管理端工作偏好。</p>
          </div>
          {saveState === "saved" ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
              已保存
            </div>
          ) : null}
        </div>
      </header>

      <main className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.7fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">当前账号</h2>
                <p className="mt-1 text-sm text-gray-500">这里只展示当前管理端会话的关键信息。</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoItem label="姓名" value={user?.name || "未命名"} />
              <InfoItem label="角色" value={user?.role === "admin" ? "管理员" : "员工"} />
              <InfoItem label="部门" value={userDepartment || "未设置部门"} />
              <InfoItem label="登录方式" value={loginSource} />
              <InfoItem label="邮箱" value={user?.email || "未设置邮箱"} />
              <InfoItem label="当前站点" value={window.location.origin} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">本地会话说明</h2>
                <p className="mt-1 text-sm text-gray-500">浏览器本地偏好与服务端密钥配置分开管理。</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p>1. 工作偏好只保存在当前浏览器，不会改数据库业务数据。</p>
              <p>2. Kimi API Key 由管理员提交到后端后加密存储，前端不回显明文。</p>
              <p>3. 清空本地缓存后，不会删除任务、员工、请假和出差数据。</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.65fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">AI 密钥配置</h2>
                <p className="mt-1 text-sm text-gray-500">
                  识别模块使用的 Kimi API Key 在服务端加密保存，不向浏览器返回明文。
                </p>
              </div>
            </div>

            {isAdmin ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">当前状态</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {aiSecurityConfig?.kimiApiKeyUnreadable
                      ? "已存储，但当前无法解密"
                      : aiSecurityConfig?.kimiApiKeyConfigured
                        ? `已配置 ${aiSecurityConfig.kimiApiKeyMaskedValue || ""}`
                        : "未配置"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    来源：
                    {aiSecurityConfig?.kimiApiKeySource === "database"
                      ? "服务端加密存储"
                      : aiSecurityConfig?.kimiApiKeySource === "database_unreadable"
                        ? "服务端已存储，但当前密钥不可读"
                        : aiSecurityConfig?.kimiApiKeySource === "env"
                          ? "环境变量"
                          : "无"}
                  </p>
                  {aiSecurityConfig?.kimiApiKeyUnreadable ? (
                    <p className="mt-2 text-xs text-amber-700">
                      通常是部署后 `APP_SECRET` 变了，导致旧密钥无法解密。
                    </p>
                  ) : null}
                  {aiSecurityConfig?.kimiApiKeyConfigured ? (
                    <p className="mt-2 text-xs text-emerald-700">
                      已保存，无需重复输入。只有更换 Key 时才需要重新填写。
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  {isEditingKimiApiKey ? (
                    <>
                      <button
                        onClick={() =>
                          setKimiApiKeyMutation.mutate({
                            apiKey: kimiApiKeyInput,
                          })
                        }
                        disabled={!kimiApiKeyInput.trim() || setKimiApiKeyMutation.isPending}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        保存到服务端
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingKimiApiKey(false);
                          setKimiApiKeyInput("");
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setIsEditingKimiApiKey(true);
                        setSecurityMessage("");
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {aiSecurityConfig?.kimiApiKeyConfigured ? "更新密钥" : "设置密钥"}
                    </button>
                  )}
                  <button
                    onClick={() => clearKimiApiKeyMutation.mutate()}
                    disabled={clearKimiApiKeyMutation.isPending}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    清除已保存密钥
                  </button>
                </div>

                {isEditingKimiApiKey ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      {aiSecurityConfig?.kimiApiKeyConfigured ? "替换 Kimi API Key" : "新的 Kimi API Key"}
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={kimiApiKeyInput}
                      onChange={(event) => setKimiApiKeyInput(event.target.value)}
                      placeholder="输入后仅提交一次，页面不会回显明文"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                ) : null}

                {securityMessage ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {securityMessage}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                只有管理员可以配置服务端 AI 密钥。普通用户不会看到或获取密钥明文。
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <EyeOff className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">安全说明</h2>
                <p className="mt-1 text-sm text-gray-500">这部分配置专门避免前端泄露和日志泄露。</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p>1. 密钥提交后只在服务端保存密文，列表和接口都不返回明文。</p>
              <p>2. 页面只显示是否已配置和末尾掩码，避免肩窥和截图泄露。</p>
              <p>3. AI 识别接口在服务端取密钥，浏览器请求里不会携带真实 Key。</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.65fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">识别策略</h2>
                <p className="mt-1 text-sm text-gray-500">
                  这里保存管理端默认识别偏好，后续新增识别页必须复用同一套设置。
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <SettingRow
                title="默认高清识别"
                description="优先使用原图做 OCR，适合长截图和小字场景。文件过大时仍会自动压缩。"
                control={
                  <Switch
                    checked={workspaceSettings.recognitionHighQuality}
                    onCheckedChange={(checked) =>
                      saveWorkspaceSettings({
                        ...workspaceSettings,
                        recognitionHighQuality: checked,
                      })
                    }
                  />
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">本地缓存</h2>
                <p className="mt-1 text-sm text-gray-500">仅重置本地偏好，不影响后端数据。</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                onClick={handleResetWorkspace}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                重置工作偏好
              </button>
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>如果后续又出现乱码、占位文案或配置页与功能页不一致，优先先修设置源，再修页面文案。</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="pt-1 sm:pl-4">{control}</div>
    </div>
  );
}
