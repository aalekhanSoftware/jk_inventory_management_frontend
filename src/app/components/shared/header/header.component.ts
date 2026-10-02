import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PageAccessService } from '../../../services/page-access.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isAuthenticated: boolean = false;
  showMasterMenu: boolean = false;
  showTransactionMenu: boolean = false;
  showPlanningMenu: boolean = false;
  isMobileMenuOpen: boolean = false;
  private authSubscription: Subscription;
  private accessSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private pageAccessService: PageAccessService,
    private router: Router
  ) {
    this.authSubscription = this.authService.authState$.subscribe(
      (isAuthenticated) => {
        this.isAuthenticated = isAuthenticated;
        if (isAuthenticated) {
          // First load after refresh, or after login already refreshed — no per-route calls.
          this.pageAccessService.ensureLoaded().subscribe();
        } else {
          this.pageAccessService.clear();
        }
      }
    );
  }

  ngOnInit(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    if (this.isAuthenticated) {
      this.pageAccessService.ensureLoaded().subscribe();
    }
    // Re-render menus when encrypted cache / API result updates.
    this.accessSubscription = this.pageAccessService.access$.subscribe(() => {
      // no-op: reading can() in template; subscription keeps change detection in sync when async load finishes
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.accessSubscription) {
      this.accessSubscription.unsubscribe();
    }
  }

  can(code: string): boolean {
    return this.pageAccessService.can(code);
  }

  isAdmin(): boolean {
    return this.pageAccessService.isAdmin() || this.authService.isAdmin();
  }

  hasMasterItems(): boolean {
    return this.can('SELECT_CATEGORY')
      || this.can('SELECT_PRODUCT')
      || this.can('SELECT_PARTY_PAYMENT')
      || this.can('SELECT_EMPLOYEE')
      || this.can('SELECT_MACHINERY')
      || this.isAdmin();
  }

  hasTransactionItems(): boolean {
    return this.can('SELECT_PURCHASE')
      || this.can('SELECT_SALE')
      || this.can('SELECT_PRODUCT_WISE_PROFIT')
      || this.can('SELECT_DAILY_PROFIT');
  }

  hasPlanningItems(): boolean {
    return this.can('SELECT_PLAN')
      || this.can('SELECT_PRODUCTION')
      || this.can('SELECT_DASHBOARD')
      || this.can('SELECT_STOCK_MOVES')
      || this.can('SELECT_DATE_REPORT')
      || this.can('SELECT_PLAN_DISPATCH')
      || this.can('SELECT_PLAN_COATING');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.mobile-menu-toggle')) {
      this.showMasterMenu = false;
      this.showTransactionMenu = false;
      this.showPlanningMenu = false;
      if (!target.closest('.nav-links')) {
        this.isMobileMenuOpen = false;
      }
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleMasterMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showMasterMenu = !this.showMasterMenu;
    this.showTransactionMenu = false;
    this.showPlanningMenu = false;
  }

  toggleTransactionMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showTransactionMenu = !this.showTransactionMenu;
    this.showMasterMenu = false;
    this.showPlanningMenu = false;
  }

  togglePlanningMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showPlanningMenu = !this.showPlanningMenu;
    this.showMasterMenu = false;
    this.showTransactionMenu = false;
  }

  isMasterActive(): boolean {
    const currentUrl = this.router.url;
    return ['/category', '/product', '/customer', '/employee', '/machinery', '/role-config', '/user-role'].some(path =>
      currentUrl.includes(path)
    );
  }

  isTransactionActive(): boolean {
    const currentUrl = this.router.url;
    return ['/purchase', '/sale', '/profit', '/daily-profit'].some(path =>
      currentUrl.includes(path)
    );
  }

  isPlanningActive(): boolean {
    const currentUrl = this.router.url;
    return ['/planning', '/production/entry', '/production/report', '/dashboard', '/stock-moves', '/stock-movements', '/plan-dispatch', '/plan-coating'].some(path =>
      currentUrl.includes(path)
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
  }
}
