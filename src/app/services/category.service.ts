import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, CategoryResponse, CategorySearchRequest } from '../models/category.model';
import { ApiResponse, PaginatedResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = `${environment.apiUrl}/api/categories`;

  constructor(private http: HttpClient) {}

  getCategories(params: CategorySearchRequest): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(`${this.apiUrl}/getCategories`, params);
  }

  searchCategories(params: CategorySearchRequest): Observable<ApiResponse<PaginatedResponse<Category>>> {
    return this.http.post<ApiResponse<PaginatedResponse<Category>>>(`${this.apiUrl}/search`, params);
  }

  createCategory(category: Category): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(`${this.apiUrl}`, category);
  }

  // ENC_URL_POST_V1: POST with id in body.
  updateCategory(id: number, category: Category): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(`${this.apiUrl}/update`, { ...category, id });
  }

  deleteCategory(id: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/delete`, { id });
  }
}