import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Database,
  KeyRound,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { getLocalAuthToken, getWechatAuthToken } from "@/lib/auth-storage";
import {
  clearKimiApiKey,
  loadKimiApiKey,
  loadManagerWorkspaceSettings,
  resetManagerWorkspaceSettings,
  saveKimiApiKey,
  saveManagerWorkspaceSettings,
  type ManagerWorkspaceSettings,
} from "@/lib/app-settings";

export function SettingsPage() {
  const { user } = useAuth();
  const userDepartment =
    user && "department" in user && typeof user.department === "string"
      ? user.department
      : "";
  const [apiKey, setApiKey] = useState("");
  const [savedApiKey, setSavedApiKey] = useState("");
  const [workspaceSettings, setWorkspaceSettings] = useState<ManagerWorkspaceSettings>({
    recognitionHighQuality: false,
  });
  const [saveState, setSaveState] = useState<"" | "saved">("");

  useEffect(() => {
    const currentApiKey = loadKimiApiKey();
    setApiKey(currentApiKey);
    setSavedApiKey(currentApiKey);
    setWorkspaceSettings(loadManagerWorkspaceSettings());
  }, []);

  const loginSource = useMemo(() => {
    if (getWechatAuthToken()) {
      return "企业微信登录";
    }
    if (getLocalAuthToken()) {
      return "本地账号登录";
    }
    return "会话登录";
  }, []);

  const showSaved = () => {
    setSaveState("saved");
    window.setTimeout(() => setSaveState(""), 1200);
  };

  const saveWorkspaceSettings = (nextSettings: ManagerWorkspaceSettings) => {
    setWorkspaceSettings(nextSettings);
    saveManagerWorkspaceSettings(nextSettings);
    showSaved();
  };

  const handleSaveApiKey = () => {
    saveKimiApiKey(apiKey);
    const latest = loadKimiApiKey();
    setApiKey(latest);
    setSavedApiKey(latest);
    showSaved();
  };

  const handleClearApiKey = () => {
    clearKimiApiKey();
    setApiKey("");
    setSavedApiKey("");
  };

  const handleResetWorkspace = () => {
    resetManagerWorkspaceSettings();
    setWorkspaceSettings(loadManagerWorkspaceSettings());
  };

  return (
    <>
      <header className="flex h-[72px] items-center justify-between border-b border-gray-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">设置中心</h1>
          <p className="text-xs text-gray-500">
            统一管理识别服务、本地缓存和管理端工作偏好。
          </p>
        </div>
        {saveState === "saved" ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <BadgeCheck className="h-4 w-4" />
            已保存
          </div>
        ) : null}
      </header>

      <main className="space-y-5 px-6 pb-6 pt-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.7fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">当前账号</h2>
                <p className="mt-1 text-sm text-gray-500">
                  这里只展示当前管理端会话的关键信息。
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoItem label="姓名" value={user?.name || "未命名"} />
              <InfoItem label="角色" value={user?.role === "admin" ? "管理员" : "员工"} />
              <InfoItem label="部门" value={userDepartment || "未设置部门"} />
              <InfoItem label="登录方式" value={loginSource} />
              <InfoItem label="邮箱" value={user?.email || "未设置邮箱"} />
              <InfoItem label="当前站点" value={window.location.origin} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">本地会话说明</h2>
                <p className="mt-1 text-sm text-gray-500">
                  设置页只管理浏览器本地缓存，不直接改数据库业务数据。
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p>1. OCR API Key 只保存在当前浏览器，用于截图识别模块。</p>
              <p>2. 工作偏好用于识别页默认策略，不影响历史记录。</p>
              <p>3. 清空本地缓存后，不会删除任务、员工、请假和出差数据。</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">OCR 服务</h2>
              <p className="mt-1 text-sm text-gray-500">
                当前任务识别、员工导入、请假识别和出差识别统一使用这一份 API Key。
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Kimi API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-2 text-xs text-gray-500">
                {savedApiKey
                  ? `当前已保存：sk-****${savedApiKey.slice(-4)}`
                  : "当前未保存 API Key，识别类功能将无法调用 OCR。"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveApiKey}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                保存 API Key
              </button>
              <button
                onClick={handleClearApiKey}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                清空 API Key
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.65fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
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

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">本地缓存</h2>
                <p className="mt-1 text-sm text-gray-500">
                  仅重置本地偏好，不影响后端数据。
                </p>
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
                  <p>
                    如果后续又出现乱码、占位文案或配置页与功能页不一致，优先先修设置源，再修页面文案。
                  </p>
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
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="pt-1">{control}</div>
    </div>
  );
}
