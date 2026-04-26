import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EditableEmployee } from "./types";

type AddEmployeeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee: EditableEmployee | null;
};

export function AddEmployeeDialog({
  isOpen,
  onClose,
  editingEmployee,
}: AddEmployeeDialogProps) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [error, setError] = useState("");

  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      void utils.user.list.invalidate();
      void utils.stats.dashboard.invalidate();
      onClose();
    },
  });

  const updateUser = trpc.user.update.useMutation({
    onSuccess: () => {
      void utils.user.list.invalidate();
      void utils.stats.dashboard.invalidate();
      onClose();
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    setError("");

    if (editingEmployee) {
      setName(editingEmployee.name);
      setDepartment(editingEmployee.department ?? "");
      setEmail(editingEmployee.email ?? "");
      setRole(editingEmployee.role as "user" | "admin");
      return;
    }

    setName("");
    setDepartment("");
    setEmail("");
    setRole("user");
  }, [editingEmployee, isOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("姓名不能为空");
      return;
    }

    setError("");

    if (editingEmployee) {
      updateUser.mutate({
        id: editingEmployee.id,
        name: name.trim(),
        department: department.trim() || undefined,
        email: email.trim() || undefined,
        role,
      });
      return;
    }

    createUser.mutate({
      name: name.trim(),
      department: department.trim() || undefined,
      email: email.trim() || undefined,
      role,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-[calc(100%-0.5rem)] overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-lg sm:p-6">
        <DialogHeader className="border-b border-gray-100 pb-4 sm:border-b-0 sm:pb-0">
          <DialogTitle>{editingEmployee ? "编辑员工" : "添加员工"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4 sm:py-0">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="员工姓名"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">部门</label>
            <input
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="例如：工程部"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">角色</label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "user" | "admin")}
              className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="user">员工</option>
              <option value="admin">管理员</option>
            </select>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end sm:border-t-0 sm:pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createUser.isPending || updateUser.isPending}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {createUser.isPending || updateUser.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {createUser.isPending || updateUser.isPending
                ? "保存中..."
                : editingEmployee
                  ? "保存修改"
                  : "添加员工"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
