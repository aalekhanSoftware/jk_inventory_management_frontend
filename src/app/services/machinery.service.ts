import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Machinery, MachineryResponse, MachinerySearchRequest } from '../models/machinery.model';
import { CacheService } from '../shared/services/cache.service';
import { EncryptionService } from '../shared/services/encryption.service';

/**
 * MACHINERY_MASTER service. Active list is cached in encrypted localStorage
 * (same pattern as products/customers) with explicit refresh support.
 */
@Injectable({
  providedIn: 'root'
})
export class MachineryService {
  private readonly CACHE_KEY = 'active_machineries';
  private apiUrl = `${environment.apiUrl}/api/machinery`;

  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
    private encryptionService: EncryptionService
  ) {}

  searchMachineries(params: MachinerySearchRequest): Observable<MachineryResponse> {
    return this.http.post<MachineryResponse>(`${this.apiUrl}/search`, params);
  }

  /** Active machineries for dropdowns (cached). */
  getMachineries(): Observable<any> {
    const encryptedData = localStorage.getItem(this.CACHE_KEY);
    if (encryptedData) {
      const decryptedData = this.encryptionService.decrypt(encryptedData);
      if (decryptedData) {
        return of(decryptedData);
      }
    }
    return this.http.post<any>(`${this.apiUrl}/getMachineries`, {}).pipe(
      tap(response => {
        if (response.success) {
          localStorage.setItem(this.CACHE_KEY, this.encryptionService.encrypt(response));
        }
      })
    );
  }

  refreshMachineries(): Observable<any> {
    localStorage.removeItem(this.CACHE_KEY);
    return this.getMachineries();
  }

  createMachinery(payload: Machinery): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, payload);
  }

  updateMachinery(payload: Machinery): Observable<any> {
    return this.http.post(`${this.apiUrl}/update`, payload);
  }

  deleteMachinery(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { id });
  }

  getMachineryDetail(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }
}
