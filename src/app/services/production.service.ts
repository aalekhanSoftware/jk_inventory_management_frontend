import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductionOperation, ProductionSearchRequest } from '../models/production.model';

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private apiUrl = `${environment.apiUrl}/api/production-operations`;
  private dashboardUrl = `${environment.apiUrl}/api/production-dashboard`;
  private movementUrl = `${environment.apiUrl}/api/stock-movements`;

  constructor(private http: HttpClient) {}

  createOperation(payload: ProductionOperation): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, payload);
  }

  getOperationDetail(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }

  updateOperation(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/update`, payload);
  }

  deleteOperation(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { id });
  }

  searchOperations(params: ProductionSearchRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/search`, params);
  }

  getTransactionsByItem(planningItemId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/by-planning-item/${planningItemId}`, {});
  }

  getDashboardSummary(planningId?: number | null, currentPage?: number | null, perPageRecord?: number | null): Observable<any> {
    const body: any = {};
    if (planningId) {
      body.planningId = planningId;
    }
    if (currentPage !== undefined && currentPage !== null) {
      body.currentPage = currentPage;
    }
    if (perPageRecord) {
      body.perPageRecord = perPageRecord;
    }
    return this.http.post(`${this.dashboardUrl}/summary`, body);
  }

  searchMovements(params: any): Observable<any> {
    return this.http.post(`${this.movementUrl}/search`, params);
  }
}
