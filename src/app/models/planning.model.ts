export interface PlanningItem {
  id?: number;
  planningId?: number;
  productId: number;
  productName?: string;
  plannedQuantity: number;
  coatingRequired?: boolean;
  remarks?: string;
  cuttingQty?: number;
  embossQty?: number;
  coatingQty?: number;
  packingQty?: number;
  dispatchQty?: number;
  remainingQty?: number;
  itemStatus?: string;
  // Total recorded stage quantity, each entry counted once (backend).
  producedQty?: number;
}

export interface Planning {
  id?: number;
  planningNumber?: string;
  planningDate?: string;
  customerId?: number | null;
  customerName?: string;
  employeeIds?: number[];
  remarks?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: PlanningItem[];
  totalPlanned?: number;
  cuttingQty?: number;
  embossQty?: number;
  coatingQty?: number;
  packingQty?: number;
  dispatchQty?: number;
  remainingQty?: number;
  productCount?: number;
}

export interface PlanningSearchRequest {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  currentPage: number;
  perPageRecord: number;
  sortBy?: string;
  sortDir?: string;
}

export interface PlanningResponse {
  success: boolean;
  message: string;
  data: {
    totalPages: number;
    content: Planning[];
    totalElements: number;
  };
}

export const PLANNING_STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'O' },
  { label: 'In Progress', value: 'P' },
  { label: 'Completed', value: 'C' },
  { label: 'Inactive', value: 'I' }
];

export function planningStatusLabel(status?: string): string {
  switch (status) {
    case 'O': return 'Open';
    case 'P': return 'In Progress';
    case 'C': return 'Completed';
    case 'I': return 'Inactive';
    default: return status || '-';
  }
}
