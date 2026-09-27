import { PowderCoatingProcess, PowderCoatingProcessItem, PowderCoatingSearchRequest } from './powder-coating.model';

/**
 * PLAN_COATING: types for the plan-linked coating screen. Reuses the old
 * powder-coating shapes (old file untouched) and adds only the plan fields.
 */
export interface PlanCoatingItem extends PowderCoatingProcessItem {
  planningId?: number | null;
  planningItemId?: number | null;
}

export interface PlanCoatingProcess extends Omit<PowderCoatingProcess, 'items'> {
  items: PlanCoatingItem[];
  planningIds?: number[];
  planningNumbers?: string[];
  planningNumber?: string | null;
}

export interface PlanCoatingSearchRequest extends PowderCoatingSearchRequest {
  sortBy?: string;
  sortDir?: string;
}

export interface PlanCoatingResponse {
  success: boolean;
  message: string;
  data: {
    content: PlanCoatingProcess[];
    totalPages: number;
    totalElements: number;
  };
}

/** One coating-eligible product row of a plan (only Coating? = Yes items). */
export interface PlanCoatingBalance {
  planningItemId: number;
  productId: number;
  productName: string;
  planned: number;
  cutting: number;
  emboss: number;
  coating: number;
  coatable: number;
}
