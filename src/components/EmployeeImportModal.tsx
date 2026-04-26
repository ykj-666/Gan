import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { trpc } from "@/providers/trpc";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

let xlsxLoader: Promise<typeof import("xlsx")> | null = null;

function loadXlsx() {
  if (!xlsxLoader) {
    xlsxLoader = import("xlsx");
  }
  return xlsxLoader;
}

type ParsedEmployee = {
  name: string;
  department?: string;
  email?: string;
  role?: "user" | "admin";
  _valid: boolean;
  _error?: string;
};

type EmployeeImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function EmployeeImportModal({
  isOpen,
  onClose,
}: EmployeeImportModalProps) {
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
      void utils.stats.dashboard.invalidate();
      void utils.user.list.invalidate();
    },
    onError: () => {
      setImportResult({ success: 0, failed: parsedData.length });
      setStep("result");
    },
  });

  const parseExcel = useCallback((file: File) => {
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await loadXlsx();
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
          header: 1,
          defval: "",
        });

        if (rows.length === 0) {
          setParsedData([]);
          setStep("preview");
          return;
        }

        const headers = rows[0].map((item) => String(item).trim());
        const nameIdx = headers.findIndex(
          (header) =>
            header.includes("姓名") ||
            header.includes("名字") ||
            header.toLowerCase() === "name",
        );
        const departmentIdx = headers.findIndex(
          (header) =>
            header.includes("部门") || header.toLowerCase() === "department",
        );
        const emailIdx = headers.findIndex(
          (header) =>
            header.includes("邮箱") ||
            header.includes("邮件") ||
            header.toLowerCase() === "email",
        );
        const roleIdx = headers.findIndex(
          (header) =>
            header.includes("角色") ||
            header.includes("职位") ||
            header.toLowerCase() === "role",
        );

        const employees: ParsedEmployee[] = [];
        for (let i = 1; i < rows.length; i += 1) {
          const row = rows[i];
          const name = nameIdx >= 0 ? row[nameIdx]?.trim() : "";
          const department = departmentIdx >= 0 ? row[departmentIdx]?.trim() : "";
          const email = emailIdx >= 0 ? row[emailIdx]?.trim() : "";
          const roleRaw = roleIdx >= 0 ? row[roleIdx]?.trim() : "";

          if (!name) {
            continue;
          }

          const lowerRole = roleRaw.toLowerCase();
          const role: "user" | "admin" =
            lowerRole.includes("admin") || roleRaw.includes("管理")
              ? "admin"
              : "user";

          employees.push({
            name,
            department: department || undefined,
            email: email || undefined,
            role,
            _valid: true,
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseExcel(file);
    }
  };

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
        parseExcel(file);
      }
    },
    [parseExcel],
  );

  const removeItem = (index: number) => {
    setParsedData((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleImport = () => {
    const validUsers = parsedData
      .filter((item) => item._valid)
      .map((item) => ({
        name: item.name,
        department: item.department,
        email: item.email,
        role: (item.role ?? "user") as "user" | "admin",
      }));

    if (validUsers.length === 0) {
      return;
    }

    batchCreate.mutate(validUsers);
  };

  const handleClose = () => {
    setStep("upload");
    setParsedData([]);
    setFileName("");
    setImportResult(null);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">导入员工信息</h2>
              <p className="text-xs text-gray-500">
                {step === "upload" && "支持 .xlsx / .xls 格式"}
                {step === "preview" && `${parsedData.length} 条数据待导入`}
                {step === "result" && "导入完成"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 transition-colors hover:bg-gray-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "upload" && (
            <div className="space-y-5">
              <div
                onDrop={handleDrop}
                onDragOver={(event: DragEvent) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                  isDragging
                    ? "scale-[1.02] border-emerald-400 bg-emerald-50/50"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
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
                  className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
                    isDragging ? "bg-emerald-100" : "bg-gray-100"
                  }`}
                >
                  <Upload
                    className={`h-8 w-8 ${
                      isDragging ? "text-emerald-600" : "text-gray-400"
                    }`}
                  />
                </div>
                <p className="mb-1 text-sm font-semibold text-gray-700">
                  {isDragging ? "释放以上传文件" : "点击或拖拽上传 Excel 文件"}
                </p>
                <p className="text-xs text-gray-400">支持 .xlsx / .xls，建议使用模板</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">导入模板</p>
                    <p className="text-xs text-gray-500">模板包含姓名、部门、邮箱、角色列</p>
                  </div>
                  <button
                    onClick={async (event) => {
                      event.stopPropagation();
                      const XLSX = await loadXlsx();
                      const templateData = [
                        ["姓名", "部门", "邮箱", "角色"],
                        ["张三", "工程部", "zhangsan@example.com", "成员"],
                        ["李四", "设计部", "lisi@example.com", "成员"],
                        ["王五", "管理部", "wangwu@example.com", "管理员"],
                      ];
                      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
                      const workbook = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(workbook, worksheet, "员工信息");
                      XLSX.writeFile(workbook, "员工导入模板.xlsx");
                    }}
                    className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    下载模板
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-600">导入说明</p>
                <div className="space-y-1.5">
                  {[
                    "Excel 第一行为表头，需包含“姓名”列",
                    "“部门”“邮箱”和“角色”列为可选",
                    "角色填写“管理员”将设置为 admin，其余为员工",
                    "重复姓名会分别导入，建议提前清洗",
                  ].map((tip) => (
                    <div key={tip} className="flex items-start gap-2">
                      <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                      <p className="text-xs text-gray-500">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-gray-700">{fileName}</span>
                </div>
                <button
                  onClick={() => {
                    setStep("upload");
                    setParsedData([]);
                    setFileName("");
                  }}
                  className="text-xs text-gray-400 transition-colors hover:text-gray-600"
                >
                  重新上传
                </button>
              </div>

              {parsedData.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertCircle className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-400">未解析到有效数据</p>
                  <p className="mt-1 text-xs text-gray-400">请检查文件表头是否包含“姓名”列</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="w-10 px-4 py-2.5 text-left font-semibold text-gray-600">#</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">姓名</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">部门</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">邮箱</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">角色</th>
                        <th className="w-12 px-4 py-2.5 text-right font-semibold text-gray-600"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((employee, index) => (
                        <tr
                          key={`${employee.name}-${index}`}
                          className={`border-t border-gray-100 ${
                            !employee._valid ? "bg-red-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-2.5 text-xs text-gray-400">{index + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                                {employee.name[0]}
                              </div>
                              <span className="font-medium text-gray-800">{employee.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{employee.department || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-500">{employee.email || "-"}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                employee.role === "admin"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {employee.role === "admin" ? "管理员" : "员工"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => removeItem(index)}
                              className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {step === "result" && importResult && (
            <div className="flex flex-col items-center justify-center py-10">
              <div
                className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
                  importResult.success > 0 ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                {importResult.success > 0 ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-10 w-10 text-red-500" />
                )}
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">
                {importResult.success > 0 ? "导入成功" : "导入失败"}
              </h3>
              <p className="mb-6 text-sm text-gray-500">
                成功导入 <span className="font-bold text-emerald-600">{importResult.success}</span> 位员工
              </p>
              <button
                onClick={handleClose}
                className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                完成
              </button>
            </div>
          )}
        </div>

        {step === "preview" && parsedData.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <span className="text-sm text-gray-500">
              共 <span className="font-bold text-gray-800">{parsedData.length}</span> 条数据，
              <span className="font-bold text-emerald-600"> {parsedData.filter((item) => item._valid).length} </span>
              条有效
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={batchCreate.isPending || parsedData.filter((item) => item._valid).length === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {batchCreate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
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


