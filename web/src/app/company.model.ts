export interface Company {
  id: number;
  code: string;
  short_name: string | null;
  tenant_id: number | null;
}

export type CompanyInput = Pick<Company, 'code' | 'short_name' | 'tenant_id'>;
