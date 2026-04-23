import { useState, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  Trash2,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedEmployee {
  name: string;
  email?: string;
  role?: string;
  _valid: boolean;
  _error?: string;
}

interface EmployeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeImportModal({ isOpen, onClose }: EmployeeImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const batchCreate = trpc.user.batchCreate.useMutation({
    onSuccess: (data) => {
      setImportResult({ success: data.count, failed: 0 });
      setStep("result");
      utils.stats.dashboard.invalidate();
      utils.user.list.invalidate();
    },
    onError: () => {
      setImportResult({ success: 0, failed: parsedData.length });
      setStep("result");
    },
  });

  const parseExcel = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(
          firstSheet,
          { header: 1, defval: "" }
        );

        if (jsonData.length === 0) {
          setParsedData([]);
          setStep("preview");
          return;
        }

        // Detect header row
        const headerRow = jsonData[0];
        const nameIdx = headerRow.findIndex(
          (h) =>
            h.includes("姓名") ||
            h.toLowerCase().includes("name") ||
            h.includes("名字")
        );
        const emailIdx = headerRow.findIndex(
          (h) =>
            h.includes("邮箱") ||
            h.toLowerCase().includes("email") ||
            h.includes("邮件")
        );
        const roleIdx = headerRow.findIndex(
          (h) =>
            h.includes("角色") ||
            h.toLowerCase().includes("role") ||
            h.includes("职位")
        );

        const employees: ParsedEmployee[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const name = nameIdx >= 0 ? row[nameIdx]?.trim() : "";
          const email = emailIdx >= 0 ? row[emailIdx]?.trim() : undefined;
          const roleRaw = roleIdx >= 0 ? row[roleIdx]?.trim() : "";

          let role: ParsedEmployee["role"] = "user";
          if (roleRaw) {
            const lower = roleRaw.toLowerCase();
            if (lower.includes("admin") || lower.includes("管理")) {
              role = "admin";
            }
          }

          if (!name) continue;

          const valid = name.length >= 1;
          employees.push({
            name,
            email: email || undefined,
            role,
            _valid: valid,
            _error: valid ? undefined : "姓名为空",
          });
        }

        setParsedData(employees);
        setStep("preview");
      } catch {
        setParsedData([]);
        setStep("preview");
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
        parseExcel(file);
      }
    },
    [parseExcel]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeItem = (index: number) => {
    setParsedData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    const validUsers = parsedData
      .filter((e) => e._valid)
      .map((e) => ({
        name: e.name,
        email: e.email,
        role: (e.role ?? "user") as "user" | "admin",
      }));

    if (validUsers.length === 0) return;

    batchCreate.mutate(validUsers);
  };

  const handleClose = () => {
    setStep("upload");
    setParsedData([]);
    setFileName("");
    setImportResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative glass-card w-full max-w-2xl mx-4 p-0 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                导入员工信息
              </h2>
              <p className="text-xs text-gray-500">
                {step === "upload" && "支持 .xlsx / .xls 格式"}
                {step === "preview" && `${parsedData.length} 条数据待导入`}
                {step === "result" && "导入完成"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/60 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-5">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? "border-emerald-400 bg-emerald-50/50 scale-[1.02]"
                    : "border-gray-300 hover:border-gray-400 hover:bg-white/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${
                    isDragging
                      ? "bg-emerald-100 scale-110"
                      : "bg-gray-100/60"
                  }`}
                >
                  <Upload
                    className={`w-8 h-8 transition-colors duration-300 ${
                      isDragging ? "text-emerald-600" : "text-gray-400"
                    }`}
                  />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  {isDragging ? "释放以上传文件" : "点击或拖拽上传 Excel 文件"}
                </p>
                <p className="text-xs text-gray-400">
                  支持 .xlsx / .xls 格式，最大 10MB
                </p>
              </div>

              {/* Template download */}
              <div className="glass-card p-4 bg-white/30">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">
                      导入模板
                    </p>
                    <p className="text-xs text-gray-500">
                      下载模板文件，按格式填写后上传
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const templateData = [
                        ["姓名", "邮箱", "角色"],
                        ["张三", "zhangsan@example.com", "成员"],
                        ["李四", "lisi@example.com", "成员"],
                        ["王五", "wangwu@example.com", "管理员"],
                      ];
                      const ws = XLSX.utils.aoa_to_sheet(templateData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "员工信息");
                      XLSX.writeFile(wb, "员工导入模板.xlsx");
                    }}
                    className="btn-jelly px-4 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    下载模板
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-600">
                  导入说明
                </p>
                <div className="space-y-1.5">
                  {[
                    "Excel 第一行为表头，需包含「姓名」列",
                    "「邮箱」和「角色」列为可选",
                    "角色填写「管理员」将设置为 admin，其余为成员",
                    "重复姓名将被分别导入",
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-500">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-gray-700">
                    {fileName}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setStep("upload");
                    setParsedData([]);
                    setFileName("");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  重新上传
                </button>
              </div>

              {parsedData.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    未解析到有效数据
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    请检查文件是否包含「姓名」列
                  </p>
                </div>
              ) : (
                <div className="border border-white/30 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/40">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-10">
                          #
                        </th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">
                          姓名
                        </th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">
                          邮箱
                        </th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">
                          角色
                        </th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600 w-12">
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((emp, idx) => (
                        <tr
                          key={idx}
                          className={`border-t border-white/20 ${
                            !emp._valid ? "bg-red-50/30" : "hover:bg-white/30"
                          } transition-colors`}
                        >
                          <td className="px-4 py-2.5 text-gray-400 text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                {emp.name[0]}
                              </div>
                              <span className="font-medium text-gray-800">
                                {emp.name}
                              </span>
                              {!emp._valid && (
                                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">
                            {emp.email || "-"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                emp.role === "admin"
                                  ? "text-amber-700 bg-amber-50"
                                  : "text-gray-600 bg-gray-100"
                              }`}
                            >
                              {emp.role === "admin" ? "管理员" : "成员"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => removeItem(idx)}
                              className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && importResult && (
            <div className="flex flex-col items-center justify-center py-10">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
                  importResult.success > 0
                    ? "bg-emerald-50"
                    : "bg-red-50"
                }`}
              >
                {importResult.success > 0 ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-500" />
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {importResult.success > 0
                  ? "导入成功"
                  : "导入失败"}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                成功导入{" "}
                <span className="font-bold text-emerald-600">
                  {importResult.success}
                </span>{" "}
                位员工
              </p>
              <button
                onClick={handleClose}
                className="btn-jelly px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                }}
              >
                完成
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === "preview" && parsedData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/30">
            <span className="text-sm text-gray-500">
              共{" "}
              <span className="font-bold text-gray-800">
                {parsedData.length}
              </span>{" "}
              条数据，{" "}
              <span className="font-bold text-emerald-600">
                {parsedData.filter((e) => e._valid).length}
              </span>{" "}
              条有效
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-white/60 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={
                  batchCreate.isPending ||
                  parsedData.filter((e) => e._valid).length === 0
                }
                className="btn-jelly flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, #10b981, #14b8a6)",
                }}
              >
                {batchCreate.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {batchCreate.isPending ? "导入中..." : "确认导入"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
