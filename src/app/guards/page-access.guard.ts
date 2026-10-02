import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { PageAccessService } from '../services/page-access.service';
import { SnackbarService } from '../shared/services/snackbar.service';

/** ROLE_PAGE_ACCESS: checks cached page-access codes (API only on login / page refresh). */
@Injectable({
  providedIn: 'root'
})
export class PageAccessGuard implements CanActivate {
  constructor(
    private pageAccessService: PageAccessService,
    private router: Router,
    private snackbar: SnackbarService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    const accessCode =
      (route.data?.['access'] as string | undefined) ||
      this.pageAccessService.resolveAccessCode(state.url);

    if (!accessCode) {
      return of(true);
    }

    return this.pageAccessService.ensureLoaded().pipe(
      map(() => {
        if (this.pageAccessService.canSync(accessCode)) {
          return true;
        }
        this.snackbar.error('You do not have access to this page');
        const fallback = this.pageAccessService.getFirstAllowedRoute();
        if (fallback === '/login' || fallback === state.url) {
          return this.router.parseUrl('/login');
        }
        return this.router.parseUrl(fallback);
      })
    );
  }
}
