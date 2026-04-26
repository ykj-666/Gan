import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, QrCode, Smartphone, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { setWechatAuthToken } from "@/lib/auth-storage";

type WechatLoginProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function WechatLogin({ isOpen, onClose }: WechatLoginProps) {
  const [status, setStatus] = useState<"loading" | "qr" | "polling" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: authUrlData } = trpc.wechatAuth.getAuthUrl.useQuery(undefined, {
    enabled: isOpen,
  });

  const mockLogin = trpc.wechatAuth.mockLogin.useMutation({
    onSuccess: (data) => {
      setWechatAuthToken(data.token);
      setStatus("success");
      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    },
    onError: (mutationError) => {
      setStatus("error");
      setErrorMessage(mutationError.message);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setStatus("loading");
      setErrorMessage("");
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      return;
    }

    if (authUrlData) {
      setStatus("qr");
    }
  }, [isOpen, authUrlData]);

  const handleMockScan = () => {
    setStatus("polling");
    pollingRef.current = setTimeout(() => {
      mockLogin.mutate({
        nickname: `微信用户${Math.floor(Math.random() * 10000)}`,
      });
    }, 1500);
  };

  const handleOpenWechatUrl = () => {
    if (!authUrlData?.url) return;

    const width = 500;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      authUrlData.url,
      "wechat_oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-card relative mx-4 w-full max-w-sm p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#07C160]">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">微信登录</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-white/60"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {status === "loading" ? (
            <div className="py-10">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-3 text-sm text-gray-500">正在加载授权信息...</p>
            </div>
          ) : null}

          {status === "qr" ? (
            <>
              <div className="relative mb-4 h-52 w-52 rounded-2xl bg-white p-4 shadow-inner">
                {authUrlData?.mockMode ? (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
                    <QrCode className="mb-2 h-16 w-16 text-gray-300" />
                    <p className="px-4 text-center text-[10px] text-gray-400">
                      模拟二维码
                      <br />
                      （开发模式）
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <iframe
                      src={authUrlData?.url}
                      className="h-full w-full border-0"
                      title="WeChat QR"
                    />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                  <div
                    className="absolute left-0 right-0 h-0.5 animate-scan bg-gradient-to-r from-transparent via-[#07C160] to-transparent"
                    style={{ animation: "scan 2s linear infinite" }}
                  />
                </div>
              </div>

              <p className="mb-1 text-center text-sm text-gray-600">请使用微信扫一扫登录</p>
              <p className="mb-4 text-center text-xs text-gray-400">二维码失效后请重新打开</p>

              {authUrlData?.mockMode ? (
                <button
                  onClick={handleMockScan}
                  className="btn-jelly mb-3 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
                  style={{ background: "#07C160" }}
                >
                  <Smartphone className="h-4 w-4" />
                  模拟扫码登录
                </button>
              ) : (
                <button
                  onClick={handleOpenWechatUrl}
                  className="btn-jelly mb-3 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
                  style={{ background: "#07C160" }}
                >
                  <MessageCircle className="h-4 w-4" />
                  打开微信授权
                </button>
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <Smartphone className="h-3.5 w-3.5" />
                <span>支持微信 7.0 及以上版本</span>
              </div>
            </>
          ) : null}

          {status === "polling" ? (
            <div className="py-10 text-center">
              <div className="relative mx-auto mb-4 h-16 w-16">
                <Loader2 className="h-16 w-16 animate-spin text-[#07C160]" />
                <Smartphone className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <p className="mb-1 text-sm font-semibold text-gray-700">扫码成功</p>
              <p className="text-xs text-gray-500">正在确认登录...</p>
            </div>
          ) : null}

          {status === "success" ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#07C160]/10">
                <MessageCircle className="h-8 w-8 text-[#07C160]" />
              </div>
              <p className="mb-1 text-sm font-semibold text-gray-700">登录成功</p>
              <p className="text-xs text-gray-500">正在跳转...</p>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <p className="mb-1 text-sm font-semibold text-gray-700">登录失败</p>
              <p className="text-xs text-gray-500">{errorMessage}</p>
              <button
                onClick={() => setStatus("qr")}
                className="mt-4 text-sm text-[#07C160] hover:underline"
              >
                重试
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
