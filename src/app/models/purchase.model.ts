export interface Purchase {
  id?: number;
  productId: number;
  productName?: string;
  categoryId?: number;
  categoryName?: string;
  quantity: number;
  unitPrice: number;
  purchaseDate: string;
  invoiceNumber?: string;
  otherExpenses?: number;
  remainingQuantity?: number;
  totalAmount?: number;
}

export interface PurchaseSearchRequest {
  currentPage: number;
  perPageRecord: number;
  search?: string;
  categoryId?: number;
  productId?: number;
}

export interface PurchaseResponse {
  content: Purchase[];
  totalElements: number;
  totalPages: number;
}