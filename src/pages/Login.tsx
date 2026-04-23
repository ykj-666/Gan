import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { WechatLogin } from "@/components/WechatLogin";
import { Sparkles, LogIn, UserPlus, ArrowRight, Eye, EyeOff, MessageCircle } from "lucide-react";

function getOAuthUrl() {
  const appId = import.meta.env.VITE_APP_ID;
  const authUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${authUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showWechat, setShowWechat] = useState(false);

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("local_auth_token", data.token);
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("local_auth_token", data.token);
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLogin) {
      if (!username || !password) {
        setError("请填写用户名和密码");
        return;
      }
      loginMutation.mutate({ username, password });
    } else {
      if (!username || !password || !name) {
        setError("请填写所有必填项");
        return;
      }
      if (password.length < 6) {
        setError("密码至少6位");
        return;
      }
      registerMutation.mutate({
        username,
        password,
        name,
        email: email || undefined,
      });
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)",
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">速派任务</h1>
          <p className="text-white/60 text-sm">高效协作平台</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/30 rounded-xl mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isLogin
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LogIn className="w-4 h-4" />
              账号登录
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                !isLogin
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              注册账号
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50/80 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="glass-input w-full px-4 py-3 text-sm text-gray-800"
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    姓名
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="您的真实姓名"
                    className="glass-input w-full px-4 py-3 text-sm text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    邮箱 (可选)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="glass-input w-full px-4 py-3 text-sm text-gray-800"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? "请输入密码" : "至少6位密码"}
                  className="glass-input w-full px-4 py-3 pr-12 text-sm text-gray-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-jelly w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60 mt-2"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }}
            >
              {isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? "登录" : "注册"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">或使用以下方式</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Social logins */}
          <div className="grid grid-cols-2 gap-3">
            {/* WeChat Login */}
            <button
              onClick={() => setShowWechat(true)}
              className="btn-jelly flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-lg"
              style={{ background: "#07C160" }}
            >
              <MessageCircle className="w-4 h-4" />
              微信登录
            </button>

            {/* Kimi OAuth */}
            <a
              href={getOAuthUrl()}
              className="btn-jelly flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-white/60 hover:bg-white/80 border border-white/40 transition-all"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Kimi 登录
            </a>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          登录即表示您同意我们的服务条款和隐私政策
        </p>
      </div>

      {/* WeChat Login Modal */}
      <WechatLogin
        isOpen={showWechat}
        onClose={() => setShowWechat(false)}
      />
    </div>
  );
}
