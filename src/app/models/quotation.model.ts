export enum QuotationStatus {
    Q = 'Quote',
    A = 'Accepted',
    D = 'Declined',
    R = 'Ready',
    P = 'Processing',
    PC = 'Packaging',
    C = 'Completed',
    I = 'Invoiced'
  }
  
  export interface QuotationItem {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxPercentage: number;
    discountPercentage: number;
    finalPrice?: number;
    status?: string;
  }
  
  export interface CreateQuotationRequest {
    customerId?: number;
    customerName: string;
    quoteDate: string;
    validUntil: string;
    remarks?: string;
    termsConditions?: string;
    items: QuotationItem[];
  }
  
  export interface QuotationResponse {
    success: boolean;
    message: string;
  }
  
  export interface StatusOption {
    label: string;
    value: string;
    disabled: boolean;
  }