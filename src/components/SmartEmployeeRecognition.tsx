import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  ScanSearch,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { compressImage } from "@/lib/image";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RecognizedEmployee = {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
};

type SmartEmployeeRecognitionProps = {
  isOpen: boolean;
  onClose: () => void;
};

function createEmptyEmployee(): RecognizedEmployee {
  return {
    name: "",
    role: "",
    department: "",
    email: "",
    phone: "",
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SmartEmployeeRecognition({
  isOpen,
  onClose,
}: SmartEmployeeRecognitionProps) {
  const utils = trpc.useUtils();
  const recognizeMutation = trpc.ai.recognizeEmployee.useMutation();
  const parseExcelMutation = trpc.ai.parseExcel.useMutation();
  const batchCreateMutation = trpc.user.batchCreate.useMutation();

  const [mode, setMode] = useState<"excel" | "ocr">("excel");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [excelBase64, setExcelBase64] = useState("");
  const [excelName, setExcelName] = useState("");
  const [employees, setEmployees] = useState<RecognizedEmployee[]>([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);


  const resetState = useCallback(() => {
    setImagePreview(null);
    setImageBase64("");
    setExcelBase64("");
    setExcelName("");
    setEmployees([]);
    setRawText("");
    setError("");
    setSaveError("");
    setIsSaving(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleImage = useCallback(async (file: File) => {
    setMode("ocr");
    setEmployees([]);
    setRawText("");
    setError("");
    setSaveError("");
    setExcelBase64("");
    setExcelName("");

    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const dataUrl = await compressImage(file, 2200, 2200, 0.92);
      setImageBase64(dataUrl.split(",")[1] ?? "");
    } catch {
      setError("截图处理失败，请重新上传。");
    }
  }, []);

  const handleExcelFile = useCallback(async (file: File) => {
    setMode("excel");
    setEmployees([]);
    setRawText("");
    setError("");
    setSaveError("");
    setImagePreview(null);
    setImageBase64("");

    try {
      setExcelName(file.name);
      setExcelBase64(await fileToBase64(file));
    } catch {
      setError("Excel 文件读取失败，请重新上传。");
    }
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) {
          void handleImage(file);
        }
        break;
      }
    },
    [handleImage],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste, isOpen]);

  const handleRecognize = async () => {
    setError("");

    try {
      if (mode === "excel") {
        if (!excelBase64) {
          setError("请先上传 Excel 文件。");
          return;
        }

        const result = await parseExcelMutation.mutateAsync({ fileBase64: excelBase64 });
        setRawText(result.raw);

        if (!result.employees.length) {
          setError("未从 Excel 中识别到员工数据，请检查表头和内容。");
          return;
        }

        setEmployees(
          result.employees.map((employee) => ({
            name: employee.name || "",
            role: employee.role || "",
            department: employee.department || "",
            email: employee.email || "",
            phone: employee.phone || "",
          })),
        );
        return;
      }

      if (!imageBase64) {
        setError("请先上传截图。");
        return;
      }
      const result = await recognizeMutation.mutateAsync({
        imageBase64,
      });
      setRawText(result.raw);

      if (!result.employees.length) {
        setError("未识别到员工信息，请更换更清晰的截图。");
        return;
      }

      setEmployees(
        result.employees.map((employee) => ({
          name: employee.name || "",
          role: employee.role || "",
          department: employee.department || "",
          email: employee.email || "",
          phone: employee.phone || "",
        })),
      );
    } catch (mutationError: any) {
      setError(mutationError.message || "员工识别失败。");
    }
  };

  const handleSaveAll = async () => {
    setSaveError("");
    const validEmployees = employees.filter((employee) => employee.name.trim());

    if (!validEmployees.length) {
      setSaveError("请至少保留一条包含员工姓名的记录。");
      return;
    }

    setIsSaving(true);
    try {
      await batchCreateMutation.mutateAsync(
        validEmployees.map((employee) => ({
          name: employee.name.trim(),
          department: employee.department.trim() || undefined,
          email: employee.email.trim() || undefined,
          role: "user" as const,
        })),
      );

      await Promise.all([
        utils.user.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);

      onClose();
    } catch (mutationError: any) {
      setSaveError(mutationError.message || "批量保存员工失败。");
    } finally {
      setIsSaving(false);
    }
  };

  const updateEmployeeField = <K extends keyof RecognizedEmployee>(
    index: number,
    field: K,
    value: RecognizedEmployee[K],
  ) => {
    setEmployees((current) =>
      current.map((employee, currentIndex) =>
        currentIndex === index ? { ...employee, [field]: value } : employee,
      ),
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-blue-600" />
            <DialogTitle>智能导入员工</DialogTitle>
          </div>
          <DialogDescription>
            支持 Excel 批量解析，也支持截图 OCR。识别结果会先进入预览区再入库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setMode("excel")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                mode === "excel" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"
              }`}
            >
              Excel 解析
            </button>
            <button
              onClick={() => setMode("ocr")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                mode === "ocr" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"
              }`}
            >
              截图 OCR
            </button>
          </div>

          {mode === "excel" ? (
            !excelBase64 ? (
              <div
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file?.name.match(/\.(xlsx|xls|csv)$/i)) {
                    void handleExcelFile(file);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onClick={() => excelInputRef.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center hover:border-blue-400 hover:bg-blue-50/40"
              >
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleExcelFile(file);
                    }
                  }}
                  className="hidden"
                />
                <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-700">点击上传或拖拽 Excel 到此处</p>
                <p className="mt-1 text-xs text-gray-500">支持 .xlsx / .xls / .csv</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-emerald-900">{excelName}</p>
                  <p className="mt-1 text-xs text-emerald-700">文件已就绪，可直接开始解析。</p>
                </div>
                <button
                  onClick={() => {
                    setExcelBase64("");
                    setExcelName("");
                    setEmployees([]);
                    setRawText("");
                  }}
                  className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  更换文件
                </button>
              </div>
            )
          ) : !imagePreview ? (
            <div
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file?.type.startsWith("image/")) {
                  void handleImage(file);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => imageInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center hover:border-blue-400 hover:bg-blue-50/40"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImage(file);
                  }
                }}
                className="hidden"
              />
              <Upload className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm font-medium text-gray-700">点击上传或拖拽截图到此处</p>
              <p className="mt-1 text-xs text-gray-500">支持直接粘贴截图（Ctrl+V）</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                <img
                  src={imagePreview}
                  alt="employee-preview"
                  className="mx-auto max-h-[360px] object-contain"
                />
                <button
                  onClick={resetState}
                  className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleRecognize}
            disabled={parseExcelMutation.isPending || recognizeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {parseExcelMutation.isPending || recognizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
            {parseExcelMutation.isPending || recognizeMutation.isPending
              ? mode === "excel"
                ? "解析中..."
                : "识别中..."
              : mode === "excel"
                ? "开始解析"
                : "开始识别"}
          </button>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {rawText ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">识别原文</h3>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                {rawText}
              </pre>
            </div>
          ) : null}

          {employees.length ? (
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">识别结果预览</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    当前入库字段为姓名、部门、邮箱。岗位和电话保留在预览区供人工核对。
                  </p>
                </div>
                <button
                  onClick={() => setEmployees((current) => [...current, createEmptyEmployee()])}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  手动添加
                </button>
              </div>

              <div className="space-y-4">
                {employees.map((employee, index) => (
                  <div key={`${employee.name}-${index}`} className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">记录 {index + 1}</p>
                      <button
                        onClick={() =>
                          setEmployees((current) =>
                            current.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                        className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">员工姓名</label>
                        <input
                          type="text"
                          value={employee.name}
                          onChange={(event) =>
                            updateEmployeeField(index, "name", event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">部门</label>
                        <input
                          type="text"
                          value={employee.department}
                          onChange={(event) =>
                            updateEmployeeField(index, "department", event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">邮箱</label>
                        <input
                          type="email"
                          value={employee.email}
                          onChange={(event) =>
                            updateEmployeeField(index, "email", event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">岗位</label>
                        <input
                          type="text"
                          value={employee.role}
                          onChange={(event) =>
                            updateEmployeeField(index, "role", event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-500">电话</label>
                        <input
                          type="text"
                          value={employee.phone}
                          onChange={(event) =>
                            updateEmployeeField(index, "phone", event.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {saveError ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || !employees.length}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving
              ? "保存中..."
              : `保存 ${employees.filter((employee) => employee.name.trim()).length} 条记录`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
