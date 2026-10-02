import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EncryptionService } from '../shared/services/encryption.service';
import { Router } from '@angular/router';

interface TokenResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    refreshToken: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<boolean>(this.isAuthenticated());
  authState$ = this.authStateSubject.asObservable();
  private refreshTokenInProgress = false;

  constructor(
    private http: HttpClient,
    private encryptionService: EncryptionService,
    private router: Router
  ) { }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/api/auth/login`, credentials).pipe(
      tap((response: any) => {
        // Drop previous user's encrypted page-access before new session starts.
        localStorage.removeItem('pageAccess');
        localStorage.setItem('token', response.accessToken);
        // Encrypt user object same like pageAccess/refreshToken/machinery cache.
        const userObj = {
          firstName: response.firstName,
          lastName: response.lastName,
          email: response.email,
          roleId: response.roleId || null,
          roleName: response.roleName || null,
          roleCode: response.roleCode || null
        };
        localStorage.setItem('user', this.encryptionService.encrypt(userObj));
        // Encrypt and store refresh token
        const encryptedRefreshToken = this.encryptionService.encrypt(response.refreshToken);
        localStorage.setItem('refreshToken', encryptedRefreshToken);
        this.authStateSubject.next(true);
      })
    );
  }

  refreshToken(): Observable<TokenResponse> {
    if (this.refreshTokenInProgress) {
      return throwError(() => new Error('Refresh token request in progress'));
    }

    this.refreshTokenInProgress = true;
    const encryptedRefreshToken = localStorage.getItem('refreshToken');

    if (!encryptedRefreshToken) {
      this.handleAuthError();
      return throwError(() => new Error('No refresh token available'));
    }

    const refreshToken = this.encryptionService.decrypt(encryptedRefreshToken);

    return this.http.post<TokenResponse>(
      `${environment.apiUrl}/api/refresh-token/new`,
      { refreshToken },
      { headers: {} }
    ).pipe(
      tap(response => {
        if (response.success) {
          localStorage.setItem('token', response.data.token);
          const encryptedNewRefreshToken = this.encryptionService.encrypt(response.data.refreshToken);
          localStorage.setItem('refreshToken', encryptedNewRefreshToken);
        }
        this.refreshTokenInProgress = false;
      }),
      catchError(error => {
        this.refreshTokenInProgress = false;
        if (error.status === 400) {
          this.handleAuthError();
        }
        return throwError(() => error);
      })
    );
  }

  private handleAuthError(): void {
    this.logout();
    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
  }

  logout(): void {
    localStorage.clear();
    this.authStateSubject.next(false);
  }

  getUser(): { firstName?: string; lastName?: string; email?: string; roleId?: number; roleName?: string; roleCode?: string } | null {
    const stored = localStorage.getItem('user');
    if (!stored) {
      return null;
    }
    try {
      // Primary path: AES-encrypted user object (same as pageAccess/refreshToken).
      const decrypted = this.encryptionService.decrypt(stored);
      if (decrypted && typeof decrypted === 'object') {
        return decrypted;
      }
      // Fallback: pre-encryption plain JSON (migrate to encrypted on read).
      try {
        const plain = JSON.parse(stored);
        if (plain && typeof plain === 'object') {
          localStorage.setItem('user', this.encryptionService.encrypt(plain));
          return plain;
        }
      } catch {
        // ignore, handled below
      }
      return null;
    } catch {
      return null;
    }
  }

  getRoleCode(): string | null {
    return this.getUser()?.roleCode || null;
  }

  isAdmin(): boolean {
    return (this.getRoleCode() || '').toUpperCase() === 'ADMIN';
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  validateClientPassword(password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/api/client/password/validate`, { password });
  }
}