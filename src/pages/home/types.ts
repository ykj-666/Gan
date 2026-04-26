export type EditableEmployee = {
  id: number;
  name: string;
  department?: string | null;
  email?: string | null;
  role: string;
};
