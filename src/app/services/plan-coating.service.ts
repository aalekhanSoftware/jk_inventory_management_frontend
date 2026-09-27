import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlanCoatingResponse, PlanCoatingSearchRequest } from '../models/plan-coating.model';

/**
 * PLAN_COATING: separate plan-linked coating API.
 * Old powder-coating.service.ts is untouched; PDF and returns keep reusing
 * the existing read-only /api/powder-coating endpoints.
 */
@Injectable({
  providedIn: 'root'
})
export class PlanCoatingService {
  private apiUrl = `${environment.apiUrl}/api/plan-coating`;

  constructor(private http: HttpClient) {}

  createProcess(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, data);
  }

  updateProcess(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/update`, data);
  }

  deleteProcess(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { id });
  }

  searchProcesses(params: PlanCoatingSearchRequest): Observable<PlanCoatingResponse> {
    return this.http.post<PlanCoatingResponse>(`${this.apiUrl}/search`, params);
  }

  getDetail(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }

  getItemBalances(planningId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/item-balances`, { planningId });
  }
}
