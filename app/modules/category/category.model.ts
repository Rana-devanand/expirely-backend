export interface ICategory {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  icon?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ICreateCategory {
  name: string;
  color?: string;
  icon?: string;
}

export interface IUpdateCategory {
  name?: string;
  color?: string;
  icon?: string;
}
