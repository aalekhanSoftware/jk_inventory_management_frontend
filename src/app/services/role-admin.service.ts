import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RoleItem {
  id: number;
  name: string;
  roleCode: string;
  status?: string;
}

export interface PageAccessItem {
  id: number;
  code: string;
  label: string;
  menuGroup: string;
  sortOrder: number;
}

export interface UserRoleItem {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  roleId?: number;
  roleName?: string;
  roleCode?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** ROLE_PAGE_ACCESS: admin APIs for roles, page-access config, and user role assignment. */
@Injectable({
  providedIn: 'root'
})
export class RoleAdminService {
  constructor(private http: HttpClient) {}

  getRoles(): Observable<ApiResponse<RoleItem[]>> {
    return this.http.post<ApiResponse<RoleItem[]>>(`${environment.apiUrl}/api/roles/getRoles`, {});
  }

  getCatalog(): Observable<ApiResponse<PageAccessItem[]>> {
    return this.http.post<ApiResponse<PageAccessItem[]>>(`${environment.apiUrl}/api/page-access/catalog`, {});
  }

  getRoleAccess(roleId: number): Observable<ApiResponse<number[]>> {
    return this.http.post<ApiResponse<number[]>>(`${environment.apiUrl}/api/page-access/role/detail`, { roleId });
  }

  updateRoleAccess(roleId: number, pageAccessIds: number[]): Observable<ApiResponse<number[]>> {
    return this.http.post<ApiResponse<number[]>>(
      `${environment.apiUrl}/api/page-access/role/update`,
      { roleId, pageAccessIds }
    );
  }

  searchUsers(body: { search?: string; page?: number; size?: number }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/api/users/search`, body);
  }

  updateUserRole(userId: number, roleId: number): Observable<ApiResponse<UserRoleItem>> {
    return this.http.put<ApiResponse<UserRoleItem>>(
      `${environment.apiUrl}/api/users/${userId}/role`,
      { roleId }
    );
  }
}
