import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { X, Upload, Wand2, Check, Loader2, Camera, RefreshCw } from "lucide-react";

interface AvatarEditorProps {
  currentAvatar?: string | null;
  name: string;
  userId: number;
  onSave: () => void;
  onClose: () => void;
}

export function AvatarEditor({ currentAvatar, name, userId, onSave, onClose }: AvatarEditorProps) {
  const [mode, setMode] = useState<"upload" | "generate">("upload");
  const [preview, setPreview] = useState<string | null>(currentAvatar ?? null);
  const [generating, setGenerating] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      utils.stats.dashboard.invalidate();
      onSave();
      onClose();
    },
  });

  const generateAvatar = trpc.user.generateAvatar.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setPreview(data.url);
      }
      setGenerating(false);
    },
    onError: () => {
      setGenerating(false);
      // Fallback to dicebear
      setPreview(
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}_${Date.now()}&backgroundColor=b6e3f4,c0aede,d1d4f9`
      );
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("图片大小不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result && result.length > 50000) {
        compressImage(result, 300, 300).then(setPreview);
      } else {
        setPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = () => {
    setGenerating(true);
    const prompt = generatePrompt.trim() ||
      `Professional cartoon avatar portrait, friendly person, clean flat illustration style, soft blue-purple gradient background, high quality, centered`;
    generateAvatar.mutate({ prompt });
  };

  const handleSave = () => {
    if (preview) {
      updateAvatar.mutate({ id: userId, avatar: preview });
    }
  };

  const handleRandomAvatar = () => {
    const styles = ["avataaars", "bottts", "fun-emoji", "lorelei", "notionists"];
    const style = styles[Math.floor(Math.random() * styles.length)];
    const seed = `${name}_${Date.now()}_${Math.random()}`;
    setPreview(`https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white border border-gray-200 rounded-xl shadow-sm w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">编辑头像</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex justify-center mb-5">
          <div className="relative group">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-28 h-28 rounded-full object-cover ring-4 ring-gray-200 shadow-lg"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-gray-200 shadow-lg">
                {name[0]}
              </div>
            )}
            <button
              onClick={handleRandomAvatar}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shadow-md hover:bg-gray-700 transition-colors"
              title="随机头像"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          <button
            onClick={() => setMode("upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === "upload"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Upload className="w-4 h-4" />
            上传照片
          </button>
          <button
            onClick={() => setMode("generate")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === "generate"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            AI 生成
          </button>
        </div>

        {mode === "upload" ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-gray-50 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">
              点击选择图片
            </p>
            <p className="text-xs text-gray-400 mt-1">
              支持 JPG、PNG，最大 2MB
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="描述想要的头像风格，如：一位穿着商务装的年轻男性，微笑，专业卡通风格..."
              rows={3}
              className="glass-input w-full px-4 py-3 text-sm text-gray-800 resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || generateAvatar.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {generating || generateAvatar.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  生成头像
                </>
              )}
            </button>
          </div>
        )}

        {/* Actions */}
        {preview && (
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={updateAvatar.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {updateAvatar.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              保存头像
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function compressImage(dataUrl: string, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxW) { h *= maxW / w; w = maxW; }
      } else {
        if (h > maxH) { w *= maxH / h; h = maxH; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}
