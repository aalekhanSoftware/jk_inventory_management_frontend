export interface PlanningItem {
  id?: number;
  planningId?: number;
  productId: number;
  productName?: string;
  plannedQuantity: number;
  // PROCESS_BAGS: optional planned bags.
  totalBags?: number | null;
  coatingRequired?: boolean;
  remarks?: string;
  cuttingQty?: number;
  embossQty?: number;
  coatingQty?: number;
  packingQty?: number;
  dispatchQty?: number;
  remainingQty?: number;
  itemStatus?: string;
  // PLAN_PRIORITY: U = Urgent, N = Normal, F = For Stock.
  priority?: string;
  // AUTO_PLAN_BUMP: true when the plan was auto-raised to the cutting total.
  autoUpdated?: boolean;
  originalPlannedQuantity?: number | null;
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

export const PLANNING_PRIORITY_OPTIONS = [
  { label: 'Urgent', value: 'U' },
  { label: 'Normal', value: 'N' },
  { label: 'For Stock', value: 'F' }
];

export function planningPriorityLabel(priority?: string): string {
  switch (priority) {
    case 'U': return 'Urgent';
    case 'F': return 'For Stock';
    default: return 'Normal';
  }
}

export function planningStatusLabel(status?: string): string {
  switch (status) {
    case 'O': return 'Open';
    case 'P': return 'In Progress';
    case 'C': return 'Completed';
    case 'I': return 'Inactive';
    default: return status || '-';
  }
}
