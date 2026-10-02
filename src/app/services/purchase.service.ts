import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Purchase, PurchaseResponse, PurchaseSearchRequest } from '../models/purchase.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private apiUrl = `${environment.apiUrl}/api/purchases`;

  constructor(private http: HttpClient) {}

  searchPurchases(params: PurchaseSearchRequest): Observable<PurchaseResponse> {
    return this.http.post<PurchaseResponse>(`${this.apiUrl}/searchPurchase`, params);
  }

  createPurchase(purchase: Purchase): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, purchase);
  }

  // ENC_URL_POST_V1: POST with id in body.
  deletePurchase(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/delete`, { id });
  }
}