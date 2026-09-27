export interface Machinery {
  id?: number;
  name: string;
  code?: string | null;
  remarks?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MachinerySearchRequest {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  currentPage: number;
  perPageRecord: number;
  sortBy?: string;
  sortDir?: string;
}

export interface MachineryResponse {
  success: boolean;
  message: string;
  data: {
    totalPages: number;
    content: Machinery[];
    totalElements: number;
  };
}

export const MACHINERY_STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'A' },
  { label: 'Inactive', value: 'I' }
];

export function machineryStatusLabel(status?: string): string {
  switch (status) {
    case 'A': return 'Active';
    case 'I': return 'Inactive';
    default: return status || '-';
  }
}
