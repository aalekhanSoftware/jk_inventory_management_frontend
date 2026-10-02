import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, shareReplay, tap, map, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { EncryptionService } from '../shared/services/encryption.service';

export interface MyPageAccess {
  roleId?: number;
  roleName?: string;
  roleCode?: string;
  admin?: boolean;
  codes?: string[];
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const STORAGE_KEY = 'pageAccess';

/**
 * ROLE_PAGE_ACCESS: loads page-access once per login / full page refresh.
 * Encrypted localStorage + in-memory cache avoid calling /api/page-access/mine on every route change.
 */
@Injectable({
  providedIn: 'root'
})
export class PageAccessService {
  private cached: MyPageAccess | null = null;
  private inFlight$: Observable<MyPageAccess> | null = null;
  /** True after a successful API load in this JS session (survives route changes, not full refresh). */
  private sessionLoaded = false;
  private readonly accessSubject = new BehaviorSubject<MyPageAccess | null>(null);
  readonly access$ = this.accessSubject.asObservable();

  private readonly routeFallback: { prefix: string; code: string }[] = [
    { prefix: '/role-config', code: '__ADMIN__' },
    { prefix: '/user-role', code: '__ADMIN__' },
    { prefix: '/category', code: 'SELECT_CATEGORY' },
    { prefix: '/product', code: 'SELECT_PRODUCT' },
    { prefix: '/customer', code: 'SELECT_PARTY_PAYMENT' },
    { prefix: '/employee-order', code: 'SELECT_EMPLOYEE_ORDER' },
    { prefix: '/employee', code: 'SELECT_EMPLOYEE' },
    { prefix: '/machinery', code: 'SELECT_MACHINERY' },
    { prefix: '/purchase', code: 'SELECT_PURCHASE' },
    { prefix: '/sale', code: 'SELECT_SALE' },
    { prefix: '/profit', code: 'SELECT_PRODUCT_WISE_PROFIT' },
    { prefix: '/daily-profit', code: 'SELECT_DAILY_PROFIT' },
    { prefix: '/powder-coating-process', code: 'SELECT_COATING' },
    { prefix: '/transport', code: 'SELECT_TRANSPORT' },
    { prefix: '/quotation', code: 'SELECT_QUOTATION' },
    { prefix: '/planning', code: 'SELECT_PLAN' },
    { prefix: '/production/entry', code: 'SELECT_PRODUCTION' },
    { prefix: '/production/edit', code: 'ADD_EDIT_PRODUCTION' },
    { prefix: '/production/report', code: 'SELECT_DATE_REPORT' },
    { prefix: '/dashboard', code: 'SELECT_DASHBOARD' },
    { prefix: '/stock-movements', code: 'SELECT_STOCK_MOVES' },
    { prefix: '/plan-dispatch', code: 'SELECT_PLAN_DISPATCH' },
    { prefix: '/plan-coating', code: 'SELECT_PLAN_COATING' }
  ];

  constructor(
    private http: HttpClient,
    private encryptionService: EncryptionService
  ) {
    // Instant menus from last encrypted cache; API still runs once on refresh via ensureLoaded().
    const stored = this.readFromStorage();
    if (stored) {
      this.cached = stored;
      this.accessSubject.next(stored);
    }
  }

  /**
   * Use cached access when already loaded this session.
   * Calls API only when force=true (login) or first load after page refresh.
   */
  loadMine(force = false): Observable<MyPageAccess> {
    if (!force && this.sessionLoaded && this.cached) {
      return of(this.cached);
    }
    if (this.inFlight$) {
      return this.inFlight$;
    }
    return this.fetchFromApi();
  }

  /** Force API call (login). Shares in-flight request if header already started one. */
  refresh(): Observable<MyPageAccess> {
    this.sessionLoaded = false;
    this.cached = null;
    if (this.inFlight$) {
      return this.inFlight$;
    }
    return this.fetchFromApi();
  }

  /** Ensure access for guards/header without refetching on every navigation. */
  ensureLoaded(): Observable<MyPageAccess> {
    return this.loadMine(false);
  }

  clear(): void {
    this.cached = null;
    this.inFlight$ = null;
    this.sessionLoaded = false;
    localStorage.removeItem(STORAGE_KEY);
    this.accessSubject.next(null);
  }

  getSnapshot(): MyPageAccess | null {
    return this.cached;
  }

  isAdmin(): boolean {
    return !!this.cached?.admin;
  }

  can(code: string): boolean {
    if (!code) {
      return true;
    }
    if (code === '__ADMIN__') {
      return this.isAdmin();
    }
    if (this.cached?.admin) {
      return true;
    }
    return !!this.cached?.codes?.includes(code);
  }

  canSync(code: string | undefined | null): boolean {
    if (!code) {
      return true;
    }
    return this.can(code);
  }

  /**
   * When HIDE_TRANSPORT_FINANCIALS is assigned (and user is not Admin),
   * Transport / Plan Dispatch edit screens hide purchase/sale amounts.
   */
  shouldHideTransportFinancials(): boolean {
    if (this.isAdmin()) {
      return false;
    }
    return this.can('HIDE_TRANSPORT_FINANCIALS');
  }

  getFirstAllowedRoute(): string {
    const order = [
      { code: 'SELECT_CATEGORY', route: '/category' },
      { code: 'SELECT_PRODUCT', route: '/product' },
      { code: 'SELECT_PARTY_PAYMENT', route: '/customer' },
      { code: 'SELECT_EMPLOYEE', route: '/employee' },
      { code: 'SELECT_MACHINERY', route: '/machinery' },
      { code: 'SELECT_PURCHASE', route: '/purchase' },
      { code: 'SELECT_SALE', route: '/sale' },
      { code: 'SELECT_PRODUCT_WISE_PROFIT', route: '/profit' },
      { code: 'SELECT_DAILY_PROFIT', route: '/daily-profit' },
      { code: 'SELECT_COATING', route: '/powder-coating-process' },
      { code: 'SELECT_TRANSPORT', route: '/transport' },
      { code: 'SELECT_QUOTATION', route: '/quotation' },
      { code: 'SELECT_EMPLOYEE_ORDER', route: '/employee-order' },
      { code: 'SELECT_PLAN', route: '/planning' },
      { code: 'SELECT_PRODUCTION', route: '/production/entry' },
      { code: 'SELECT_DASHBOARD', route: '/dashboard' },
      { code: 'SELECT_STOCK_MOVES', route: '/stock-movements' },
      { code: 'SELECT_DATE_REPORT', route: '/production/report' },
      { code: 'SELECT_PLAN_DISPATCH', route: '/plan-dispatch' },
      { code: 'SELECT_PLAN_COATING', route: '/plan-coating' }
    ];

    if (this.isAdmin()) {
      return '/category';
    }

    for (const item of order) {
      if (this.can(item.code)) {
        return item.route;
      }
    }
    return '/login';
  }

  resolveAccessCode(url: string): string | null {
    const path = (url || '').split('?')[0];
    for (const item of this.routeFallback) {
      if (path === item.prefix || path.startsWith(item.prefix + '/')) {
        return item.code;
      }
    }
    return null;
  }

  private fetchFromApi(): Observable<MyPageAccess> {
    if (this.inFlight$) {
      return this.inFlight$;
    }

    this.inFlight$ = this.http
      .post<ApiResponse<MyPageAccess>>(`${environment.apiUrl}/api/page-access/mine`, {})
      .pipe(
        map(res => res?.data || { admin: false, codes: [] }),
        tap(data => {
          this.applyAccess(data);
          this.inFlight$ = null;
        }),
        catchError(() => {
          this.inFlight$ = null;
          const stored = this.readFromStorage();
          const fallback = stored || { admin: false, codes: [] as string[] };
          this.applyAccess(fallback);
          return of(fallback);
        }),
        shareReplay(1)
      );

    return this.inFlight$;
  }

  private applyAccess(data: MyPageAccess): void {
    this.cached = data;
    this.sessionLoaded = true;
    this.writeToStorage(data);
    this.accessSubject.next(data);
  }

  private writeToStorage(data: MyPageAccess): void {
    try {
      const encrypted = this.encryptionService.encrypt(data);
      if (encrypted) {
        localStorage.setItem(STORAGE_KEY, encrypted);
      }
    } catch {
      // ignore storage failures
    }
  }

  private readFromStorage(): MyPageAccess | null {
    try {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (!encrypted) {
        return null;
      }
      const data = this.encryptionService.decrypt(encrypted);
      if (!data || typeof data !== 'object') {
        return null;
      }
      return data as MyPageAccess;
    } catch {
      return null;
    }
  }
}
