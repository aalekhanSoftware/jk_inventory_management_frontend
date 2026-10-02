import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { PageAccessService } from '../../services/page-access.service';

/**
 * ROLE_PAGE_ACCESS: structural directive to show/hide UI by page-access code.
 * Usage: *appCanAccess="'ADD_EDIT_PLAN'"
 */
@Directive({
  selector: '[appCanAccess]',
  standalone: true
})
export class CanAccessDirective implements OnInit, OnDestroy {
  private code = '';
  private accessSub?: Subscription;
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef,
    private pageAccessService: PageAccessService
  ) {}

  @Input()
  set appCanAccess(code: string) {
    this.code = code || '';
    this.updateView();
  }

  ngOnInit(): void {
    this.accessSub = this.pageAccessService.access$.subscribe(() => this.updateView());
    this.updateView();
  }

  ngOnDestroy(): void {
    this.accessSub?.unsubscribe();
  }

  private updateView(): void {
    const allowed = !this.code || this.pageAccessService.can(this.code);
    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
