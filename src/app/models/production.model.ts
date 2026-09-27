export type ProductionOperationType =
  | 'CUTTING'
  | 'EMBOSS'
  | 'CUTTING_EMBOSS'
  | 'COATING'
  | 'PACKING'
  | 'DISPATCH';

export const OPERATION_OPTIONS: { label: string; value: ProductionOperationType; hint: string }[] = [
  { label: 'Cutting', value: 'CUTTING', hint: 'Raw in → output out (stock moves)' },
  { label: 'Emboss', value: 'EMBOSS', hint: 'Same product, progress only' },
  { label: 'Cutting + Emboss', value: 'CUTTING_EMBOSS', hint: 'One entry, counts to both stages' },
  { label: 'Coating', value: 'COATING', hint: 'Same product, only if coating required' },
  { label: 'Packing', value: 'PACKING', hint: 'Same product, progress only' },
  { label: 'Dispatch', value: 'DISPATCH', hint: 'Finished stock out' }
];

export interface ProductionOperation {
  id?: number;
  planningId?: number;
  planningNumber?: string;
  planningItemId: number;
  operationType: ProductionOperationType | string;
  inputProductId?: number | null;
  inputProductName?: string;
  outputProductId: number;
  outputProductName?: string;
  quantity: number;
  // PROCESS_BAGS: optional (informational only).
  totalBags?: number | null;
  operationDate?: string;
  employeeIds?: number[];
  // MACHINERY_MASTER: dropdown-selected machine (replaces machineRemarks).
  machineryId?: number | null;
  machineryName?: string;
  powderCoatingProcessId?: number | null;
  transportId?: number | null;
  remarks?: string;
  createdAt?: string;
}

export interface ProductionSearchRequest {
  search?: string;
  planningId?: number | null;
  planningItemId?: number | null;
  operationType?: string;
  startDate?: string;
  endDate?: string;
  currentPage: number;
  perPageRecord: number;
}

export interface StockMovement {
  id?: number;
  productionOperationId?: number;
  planningNumber?: string;
  inputProductName?: string;
  inputQuantity?: number | null;
  outputProductName?: string;
  outputQuantity?: number;
  movementType?: string;
  processStage?: string;
  createdAt?: string;
  createdByName?: string;
}

export interface DashboardSummary {
  planned: number;
  cutting: number;
  emboss: number;
  coating: number;
  packing: number;
  dispatch: number;
  remaining: number;
  breakdown: DashboardRow[];
}

export interface DashboardRow {
  planningId: number;
  planningNumber: string;
  planningItemId: number;
  productId: number;
  productName: string;
  coatingRequired: boolean;
  planned: number;
  cutting: number;
  emboss: number;
  coating: number;
  packing: number;
  dispatch: number;
  remaining: number;
  status: string;
}
