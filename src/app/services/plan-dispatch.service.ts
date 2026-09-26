import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * PLAN_DISPATCH: separate plan-linked dispatch API.
 * Old transport.service.ts is untouched; PDF reuses the existing
 * read-only /api/transport/generate-pdf endpoint.
 */
@Injectable({
  providedIn: 'root'
})
export class PlanDispatchService {
  private apiUrl = `${environment.apiUrl}/api/plan-dispatch`;
  private transportApiUrl = `${environment.apiUrl}/api/transport`;

  constructor(private http: HttpClient) {}

  createDispatch(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, data);
  }

  updateDispatch(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/update`, data);
  }

  deleteDispatch(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { id });
  }

  searchDispatches(params: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/search`, params);
  }

  getDispatchDetail(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }

  getItemBalances(planningId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/item-balances`, { planningId });
  }

  generatePdf(id: number): Observable<{ blob: Blob; filename: string }> {
    return this.http.post(`${this.transportApiUrl}/generate-pdf`, { id }, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'transport.pdf';
        const blob = new Blob([response.body!], { type: 'application/pdf' });
        return { blob, filename };
      })
    );
  }
}
