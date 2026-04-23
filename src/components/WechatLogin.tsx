import { useState, useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { X, QrCode, Smartphone, Loader2, MessageCircle } from "lucide-react";

interface WechatLoginProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WechatLogin({ isOpen, onClose }: WechatLoginProps) {
  const [status, setStatus] = useState<"loading" | "qr" | "polling" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: authUrlData } = trpc.wechatAuth.getAuthUrl.useQuery(undefined, {
    enabled: isOpen,
  });

  const mockLogin = trpc.wechatAuth.mockLogin.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("wechat_auth_token", data.token);
      setStatus("success");
      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    },
    onError: (err) => {
      setStatus("error");
      setErrorMsg(err.message);
    },
  });

  // Simulate QR code scanning flow
  useEffect(() => {
    if (!isOpen) {
      setStatus("loading");
      setErrorMsg("");
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      return;
    }

    if (authUrlData) {
      if (authUrlData.mockMode) {
        // In mock mode, show QR simulation
        setStatus("qr");
      } else {
        // Real WeChat mode - show the actual QR URL
        setStatus("qr");
      }
    }
  }, [isOpen, authUrlData]);

  const handleMockScan = () => {
    setStatus("polling");
    // Simulate scanning delay
    setTimeout(() => {
      mockLogin.mutate({
        nickname: `微信用户${Math.floor(Math.random() * 10000)}`,
      });
    }, 1500);
  };

  const handleOpenWechatUrl = () => {
    if (authUrlData?.url) {
      // Open WeChat auth in a popup window
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        authUrlData.url,
        "wechat_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card w-full max-w-sm mx-4 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#07C160] flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">微信登录</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/60 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center">
          {status === "loading" && (
            <div className="py-10">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500 mt-3">正在加载...</p>
            </div>
          )}

          {status === "qr" && (
            <>
              {/* QR Code Display */}
              <div className="relative w-52 h-52 bg-white rounded-2xl p-4 shadow-inner mb-4">
                {authUrlData?.mockMode ? (
                  // Mock mode - show simulated QR code
                  <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                    <QrCode className="w-16 h-16 text-gray-300 mb-2" />
                    <p className="text-[10px] text-gray-400 text-center px-4">
                      模拟二维码
                      <br />
                      (开发模式)
                    </p>
                  </div>
                ) : (
                  // Real mode - would embed actual WeChat QR
                  <div className="w-full h-full flex items-center justify-center">
                    <iframe
                      src={authUrlData?.url}
                      className="w-full h-full border-0"
                      title="WeChat QR"
                    />
                  </div>
                )}

                {/* Scan overlay animation */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#07C160] to-transparent animate-scan"
                    style={{ animation: "scan 2s linear infinite" }}
                  />
                </div>
              </div>

              <p className="text-sm text-gray-600 text-center mb-1">
                请使用微信扫一扫登录
              </p>
              <p className="text-xs text-gray-400 text-center mb-4">
                刷新二维码
              </p>

              {/* Mock scan button for development */}
              {authUrlData?.mockMode && (
                <button
                  onClick={handleMockScan}
                  className="btn-jelly flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg mb-3"
                  style={{ background: "#07C160" }}
                >
                  <Smartphone className="w-4 h-4" />
                  模拟扫码登录
                </button>
              )}

              {!authUrlData?.mockMode && (
                <button
                  onClick={handleOpenWechatUrl}
                  className="btn-jelly flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg mb-3"
                  style={{ background: "#07C160" }}
                >
                  <MessageCircle className="w-4 h-4" />
                  打开微信授权
                </button>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                <Smartphone className="w-3.5 h-3.5" />
                <span>微信 v7.0 以上版本支持</span>
              </div>
            </>
          )}

          {status === "polling" && (
            <div className="py-10 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <Loader2 className="w-16 h-16 animate-spin text-[#07C160]" />
                <Smartphone className="w-6 h-6 text-gray-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                扫码成功
              </p>
              <p className="text-xs text-gray-500">正在确认登录...</p>
            </div>
          )}

          {status === "success" && (
            <div className="py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-[#07C160]/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-[#07C160]" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                登录成功
              </p>
              <p className="text-xs text-gray-500">正在跳转...</p>
            </div>
          )}

          {status === "error" && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                登录失败
              </p>
              <p className="text-xs text-gray-500">{errorMsg}</p>
              <button
                onClick={() => setStatus("qr")}
                className="mt-4 text-sm text-[#07C160] hover:underline"
              >
                重试
              </button>
            </div>
          )}
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
