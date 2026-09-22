export interface PowderCoatingProcessItem {
  id?: number;
  productId: number;
  productName?: string;
  quantity: number;
  remainingQuantity?: number;
  totalBags: number;
  unitPrice: number;
  totalAmount?: number;
  remarks?: string;
}

export interface PowderCoatingProcess {
  id: number;
  customerId: number;
  customerName: string;
  status: string;
  createdAt: string;
  items: PowderCoatingProcessItem[];
  showReturns?: boolean;
  returns?: PowderCoatingReturn[];
  isLoadingReturns?: boolean;
}

export interface PowderCoatingSearchRequest {
  search?: string;
  currentPage: number;
  perPageRecord: number;
  customerId?: number;
  productId?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface PowderCoatingResponse {
  success: boolean;
  message: string;
  data: {
    content: PowderCoatingProcess[];
    totalPages: number;
    totalElements: number;
    size: number;
    number: number;
  };
}

export interface PowderCoatingReturn {
  id: number;
  returnQuantity: number;
  createdAt: string;
  processId?: number;
  processItemId?: number;
  productName?: string;
}

export interface PowderCoatingReturnResponse {
  success: boolean;
  message: string;
  data: PowderCoatingReturn[];
}

export interface PowderCoatingReturnRequest {
  processItemId: number;
  returnQuantity: number;
  returnDate?: string;
} 