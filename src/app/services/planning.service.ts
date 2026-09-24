import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Planning, PlanningResponse, PlanningSearchRequest } from '../models/planning.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningService {
  private apiUrl = `${environment.apiUrl}/api/plannings`;

  constructor(private http: HttpClient) {}

  searchPlannings(params: PlanningSearchRequest): Observable<PlanningResponse> {
    return this.http.post<PlanningResponse>(`${this.apiUrl}/search`, params);
  }

  createPlanning(planning: Planning): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, planning);
  }

  updatePlanning(planning: Planning): Observable<any> {
    return this.http.post(`${this.apiUrl}/update`, planning);
  }

  deletePlanning(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { id });
  }

  getPlanningDetail(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }

  /** Slim items-only array for dropdowns (lighter than full detail). */
  getPlanningItems(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/items`, { id });
  }

  copyFromEmployeeOrder(employeeOrderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/copy-from-employee-order`, { employeeOrderId });
  }
}
