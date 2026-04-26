import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, adminQuery } from "../middleware";
import { getKimiApiKey } from "../lib/system-settings";

type KimiCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ParsedJson = Record<string, unknown>;

const EMPLOYEE_PROMPT = `请识别图片中的员工信息，并严格返回 JSON。

适用图片：
- Excel / 表格截图
- 花名册截图
- 工牌、名片、简历截图

提取字段：
- name: 员工姓名，必填
- role: 岗位、职务、专业方向
- department: 部门
- email: 邮箱
- phone: 电话

输出格式：
{"employees":[{"name":"张三","role":"结构工程师","department":"工程部","email":"","phone":""}]}

要求：
1. 如果图片里有多条记录，返回全部记录。
2. 无法识别的字段返回空字符串。
3. 只返回 JSON，不要解释。`;

const TASK_PROMPT = `请识别图片中的任务或项目安排，并严格返回 JSON。

提取字段：
- projectName: 项目名称或任务名称，必填
- assigneeName: 负责人姓名
- plannedEndDate: 截止日期，格式 YYYY-MM-DD
- priority: urgent / high / medium / low
- status: todo / in_progress / review / done
- remark: 备注

输出格式：
{"tasks":[{"projectName":"XX 项目","assigneeName":"张三","plannedEndDate":"2026-05-01","priority":"high","status":"todo","remark":""}]}

要求：
1. 多条任务全部返回。
2. 日期尽量转成 YYYY-MM-DD。
3. 只返回 JSON，不要解释。`;

const LEAVE_PROMPT = `你是请假记录提取助手。请从聊天截图中识别请假记录，并严格返回 JSON。

提取字段：
- employeeName: 请假员工姓名
- type: sick / annual / personal / marriage / maternity / other
- startDate: 开始日期，格式 YYYY-MM-DD
- endDate: 结束日期，格式 YYYY-MM-DD
- days: 请假天数
- reason: 请假原因
- approved: 是否已确认，true 或 false

输出格式：
{"leaves":[{"employeeName":"张三","type":"sick","startDate":"2026-04-24","endDate":"2026-04-24","days":1,"reason":"发烧","approved":true}]}

要求：
1. 只提取和请假相关的内容。
2. 多个员工请假时分别返回。
3. 看不清或没有的信息返回空字符串或合理默认值。
4. 只返回 JSON，不要解释。`;

const BUSINESS_TRIP_PROMPT = `你是出差考勤信息提取助手。请从派遣函、现场证明或出差说明截图中提取出差信息，并严格返回 JSON。

提取字段：
- employeeName: 员工姓名
- department: 部门
- dispatchStart: 派遣起始日，格式 YYYY-MM-DD
- dispatchEnd: 派遣结束日，格式 YYYY-MM-DD
- location: 出差地点
- projectCode: 项目编号

输出格式：
{"trips":[{"employeeName":"张三","department":"工程部","dispatchStart":"2025-11-25","dispatchEnd":"2025-12-24","location":"上海浦东","projectCode":"SY-240619-GS-S"}]}

要求：
1. 以函件或证明中的正式字段为准。
2. 多条记录全部返回。
3. 识别不到的字段返回空字符串。
4. 只返回 JSON，不要解释。`;

const LEAVE_TEXT_PROMPT = `You extract leave records from Chinese natural-language descriptions and return JSON only.
Schema:
{"leaves":[{"employeeName":"张三","type":"annual","startDate":"2026-04-01","endDate":"2026-04-03","days":3,"reason":"","approved":true}]}

Rules:
- Supported type values: sick, annual, personal, marriage, maternity, other.
- If the text gives start date plus days, infer endDate.
- If the text gives start date plus end date, infer days.
- If month/day is provided without year, assume the current year.
- If approval is not mentioned, set approved to true.
- Return JSON only.`;

const BUSINESS_TRIP_TEXT_PROMPT = `You extract business-trip attendance records from Chinese natural-language descriptions and return JSON only.
Schema:
{"trips":[{"employeeName":"张三","department":"","dispatchStart":"2026-04-01","dispatchEnd":"2026-04-04","location":"上海","projectName":"上海和辉光电项目","projectCode":""}]}

Rules:
- If the text gives start date plus trip days, infer dispatchEnd.
- If month/day is provided without year, assume the current year.
- Prefer filling projectName when present. If projectCode is not mentioned, return an empty string.
- Missing fields should be empty strings.
- Return JSON only.`;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）:：/\\_-]/g, "");
}

function findColumnIndex(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) =>
    aliases.some((alias) => header.includes(normalizeHeader(alias))),
  );
}

function mapHeadersToFields(headers: string[]) {
  const name = findColumnIndex(headers, ["姓名", "名字", "员工姓名", "name"]);
  const department = findColumnIndex(headers, ["部门", "科室", "所属部门", "department"]);
  const role = findColumnIndex(headers, [
    "岗位",
    "职位",
    "职务",
    "职称",
    "专业",
    "角色",
    "title",
    "role",
  ]);
  const email = findColumnIndex(headers, ["邮箱", "邮件", "email"]);
  const phone = findColumnIndex(headers, ["电话", "手机", "联系电话", "phone"]);

  return {
    name: name >= 0 ? name : undefined,
    department: department >= 0 ? department : undefined,
    role: role >= 0 ? role : undefined,
    email: email >= 0 ? email : undefined,
    phone: phone >= 0 ? phone : undefined,
  };
}

function extractEmployeesFromRows(headers: string[], rows: unknown[][]) {
  const fieldMap = mapHeadersToFields(headers);
  const employees: Array<{
    name: string;
    role: string;
    department: string;
    email: string;
    phone: string;
  }> = [];

  for (const row of rows) {
    if (!row || row.every((cell) => !String(cell ?? "").trim())) {
      continue;
    }

    const getCell = (index?: number) => (index === undefined ? "" : String(row[index] ?? "").trim());

    let name = getCell(fieldMap.name);
    if (!name) {
      const fallback = row
        .map((cell) => String(cell ?? "").trim())
        .find((cell) => /^[一-龥]{2,4}$/.test(cell));
      name = fallback ?? "";
    }

    if (!name) {
      continue;
    }

    employees.push({
      name,
      role: getCell(fieldMap.role),
      department: getCell(fieldMap.department),
      email: getCell(fieldMap.email),
      phone: getCell(fieldMap.phone),
    });
  }

  return employees;
}

function sanitizeJsonText(content: string) {
  return content.replace(/```json|```/gi, "").trim();
}

function parseJsonFromContent(content: string): ParsedJson {
  const sanitized = sanitizeJsonText(content);

  try {
    return JSON.parse(sanitized) as ParsedJson;
  } catch {
    const start = sanitized.indexOf("{");
    const end = sanitized.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(sanitized.slice(start, end + 1)) as ParsedJson;
    }
    return {};
  }
}

function validateBase64Size(base64: string, maxMb = 10) {
  const approximateBytes = (base64.length * 3) / 4;
  if (approximateBytes > maxMb * 1024 * 1024) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `图片大小超过 ${maxMb}MB 限制`,
    });
  }
}

async function callKimiVision(imageBase64: string, prompt: string) {
  const apiKey = await getKimiApiKey();
  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Kimi API Key 未配置，请联系管理员",
    });
  }

  validateBase64Size(imageBase64, 10);

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k-vision-preview",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "你是信息提取助手。请只返回结构化 JSON，不要添加解释文字。",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR 服务调用失败 (${response.status})：${errorText}`);
  }

  const data = (await response.json()) as KimiCompletionResponse;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return {
    raw: content,
    parsed: parseJsonFromContent(content),
  };
}

async function callKimiText(text: string, prompt: string) {
  const apiKey = await getKimiApiKey();
  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Kimi API Key 未配置，请联系管理员",
    });
  }

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "你是信息提取助手。请只返回结构化 JSON，不要添加解释文字。",
        },
        {
          role: "user",
          content: `${prompt}\n\nCurrent date: ${new Date().toISOString().slice(0, 10)}\n\nInput text:\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR 服务调用失败 (${response.status})：${errorText}`);
  }

  const data = (await response.json()) as KimiCompletionResponse;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return {
    raw: content,
    parsed: parseJsonFromContent(content),
  };
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDate(value: unknown) {
  const text = normalizeString(value);
  if (!text) return "";

  const match = text
    .replace(/[.\/年]/g, "-")
    .replace(/[月]/g, "-")
    .replace(/[日]/g, "")
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!match) {
    return text;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = normalizeString(value).replace(/[^\d.]/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTaskPriority(value: unknown): "low" | "medium" | "high" | "urgent" {
  const text = normalizeString(value).toLowerCase();
  if (["urgent", "紧急", "加急", "最高"].some((item) => text.includes(item))) return "urgent";
  if (["high", "高", "重要"].some((item) => text.includes(item))) return "high";
  if (["low", "低"].some((item) => text.includes(item))) return "low";
  return "medium";
}

function normalizeTaskStatus(value: unknown): "todo" | "in_progress" | "review" | "done" {
  const text = normalizeString(value).toLowerCase();
  if (["done", "完成", "已完成", "closed"].some((item) => text.includes(item))) return "done";
  if (["review", "审核", "评审", "验收"].some((item) => text.includes(item))) return "review";
  if (["in_progress", "进行", "处理中", "开发中", "执行中"].some((item) => text.includes(item))) {
    return "in_progress";
  }
  return "todo";
}

function normalizeLeaveType(
  value: unknown,
): "sick" | "annual" | "personal" | "marriage" | "maternity" | "other" {
  const text = normalizeString(value).toLowerCase();
  if (["sick", "病假", "生病", "医院"].some((item) => text.includes(item))) return "sick";
  if (["annual", "年假", "年休"].some((item) => text.includes(item))) return "annual";
  if (["personal", "事假", "私事"].some((item) => text.includes(item))) return "personal";
  if (["marriage", "婚假", "结婚"].some((item) => text.includes(item))) return "marriage";
  if (["maternity", "产假", "育儿"].some((item) => text.includes(item))) return "maternity";
  return "other";
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const text = normalizeString(value).toLowerCase();
  if (["true", "yes", "y", "已确认", "同意", "批准", "通过"].includes(text)) return true;
  if (["false", "no", "n", "未确认", "不同意", "拒绝"].includes(text)) return false;
  return fallback;
}

const employeeSchema = z.object({
  name: z.string().min(1),
  role: z.string().default(""),
  department: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
});

const taskSchema = z.object({
  projectName: z.string().min(1),
  assigneeName: z.string().default(""),
  plannedEndDate: z.string().default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "review", "done"]).default("todo"),
  remark: z.string().default(""),
});

const leaveSchema = z.object({
  employeeName: z.string().min(1),
  type: z.enum(["sick", "annual", "personal", "marriage", "maternity", "other"]).default("other"),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  days: z.number().default(1),
  reason: z.string().default(""),
  approved: z.boolean().default(true),
});

const tripSchema = z.object({
  employeeName: z.string().min(1),
  department: z.string().default(""),
  dispatchStart: z.string().default(""),
  dispatchEnd: z.string().default(""),
  location: z.string().default(""),
  projectName: z.string().default(""),
  projectCode: z.string().default(""),
});

function normalizeEmployeeResult(item: unknown) {
  const source = (item ?? {}) as Record<string, unknown>;
  const parsed = employeeSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  return {
    name: normalizeString(source.name),
    role: normalizeString(source.role),
    department: normalizeString(source.department),
    email: normalizeString(source.email),
    phone: normalizeString(source.phone),
  };
}

function normalizeTaskResult(item: unknown) {
  const source = (item ?? {}) as Record<string, unknown>;
  const parsed = taskSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  return {
    projectName: normalizeString(source.projectName),
    assigneeName: normalizeString(source.assigneeName),
    plannedEndDate: normalizeDate(source.plannedEndDate),
    priority: normalizeTaskPriority(source.priority),
    status: normalizeTaskStatus(source.status),
    remark: normalizeString(source.remark),
  };
}

function normalizeLeaveResult(item: unknown) {
  const source = (item ?? {}) as Record<string, unknown>;
  const parsed = leaveSchema.safeParse(source);
  if (parsed.success) {
    return {
      ...parsed.data,
      days: Math.max(0.5, parsed.data.days),
    };
  }
  return {
    employeeName: normalizeString(source.employeeName),
    type: normalizeLeaveType(source.type),
    startDate: normalizeDate(source.startDate),
    endDate: normalizeDate(source.endDate),
    days: Math.max(0.5, normalizeNumber(source.days, 1)),
    reason: normalizeString(source.reason),
    approved: normalizeBoolean(source.approved, true),
  };
}

function normalizeTripResult(item: unknown) {
  const source = (item ?? {}) as Record<string, unknown>;
  const parsed = tripSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  return {
    employeeName: normalizeString(source.employeeName),
    department: normalizeString(source.department),
    dispatchStart: normalizeDate(source.dispatchStart),
    dispatchEnd: normalizeDate(source.dispatchEnd),
    location: normalizeString(source.location),
    projectName: normalizeString(source.projectName),
    projectCode: normalizeString(source.projectCode),
  };
}

function ensureArray<T>(value: unknown, fallbackItemKey?: string) {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (
    value &&
    typeof value === "object" &&
    fallbackItemKey &&
    normalizeString((value as Record<string, unknown>)[fallbackItemKey])
  ) {
    return [value as T];
  }

  return [];
}

export const aiRecognitionRouter = createRouter({
  parseExcel: adminQuery
    .input(z.object({ fileBase64: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        validateBase64Size(input.fileBase64, 20);
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(input.fileBase64, { type: "base64" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        }) as unknown[][];

        if (data.length < 2) {
          return {
            employees: [],
            raw: "表格为空，或没有可识别的数据行。",
          };
        }

        const headers = data[0].map((cell) => String(cell ?? ""));
        const rows = data.slice(1);

        return {
          employees: extractEmployeesFromRows(headers, rows),
          raw: data.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")).join("\n"),
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Excel 解析失败",
        });
      }
    }),

  recognizeEmployee: adminQuery
    .input(
      z.object({
        imageBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await callKimiVision(input.imageBase64, EMPLOYEE_PROMPT);
        const employees = ensureArray(result.parsed.employees, "name").map(normalizeEmployeeResult);
        return {
          raw: result.raw,
          employees,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "员工识别失败",
        });
      }
    }),

  recognizeTask: adminQuery
    .input(
      z.object({
        imageBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await callKimiVision(input.imageBase64, TASK_PROMPT);
        const tasks = ensureArray(result.parsed.tasks, "projectName").map(normalizeTaskResult);
        return {
          raw: result.raw,
          tasks,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "任务识别失败",
        });
      }
    }),

  recognizeLeave: adminQuery
    .input(
      z.object({
        imageBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await callKimiVision(input.imageBase64, LEAVE_PROMPT);
        const leaves = ensureArray(result.parsed.leaves, "employeeName").map(normalizeLeaveResult);
        return {
          raw: result.raw,
          leaves,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "请假识别失败",
        });
      }
    }),

  recognizeLeaveText: adminQuery
    .input(
      z.object({
        text: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await callKimiText(input.text, LEAVE_TEXT_PROMPT);
        const leaves = ensureArray(result.parsed.leaves, "employeeName").map(normalizeLeaveResult);
        return {
          raw: result.raw,
          leaves,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "请假识别失败",
        });
      }
    }),

  recognizeBusinessTrip: adminQuery
    .input(
      z.object({
        imageBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await callKimiVision(
          input.imageBase64,
          BUSINESS_TRIP_PROMPT,
        );
        const trips = ensureArray(result.parsed.trips, "employeeName").map(normalizeTripResult);
        return {
          raw: result.raw,
          trips,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "出差识别失败",
        });
      }
    }),

  recognizeBusinessTripText: adminQuery
    .input(
      z.object({
        text: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await callKimiText(input.text, BUSINESS_TRIP_TEXT_PROMPT);
        const trips = ensureArray(result.parsed.trips, "employeeName").map(normalizeTripResult);
        return {
          raw: result.raw,
          trips,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "出差识别失败",
        });
      }
    }),
});
