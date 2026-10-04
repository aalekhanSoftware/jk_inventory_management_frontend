import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { PlanningService } from '../../../services/planning.service';
import { PlanCoatingService } from '../../../services/plan-coating.service';
import { PowderCoatingService } from '../../../services/powder-coating.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { PowderCoatingReturn } from '../../../models/powder-coating.model';
import { ReturnModalComponent } from '../../powder-coating/return-modal/return-modal.component';
import { ModalService } from '../../../services/modal.service';

/**
 * PLAN_COATING form: same customer/items/prices/returns behaviour as the old
 * Powder Coating screen (untouched), plus a per-ROW Plan + Product option.
 * Row without plan = plain coating row (any product). Row with plan = product
 * must belong to that plan and be flagged "Coating?"; saving auto-creates
 * COATING progress entries (reversed on edit/delete). Rows may span plans.
 */
@Component({
  selector: 'app-plan-coating-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    LoaderComponent,
    RouterLink,
    ReturnModalComponent
  ],
  templateUrl: './plan-coating-form.component.html',
  styleUrls: ['./plan-coating-form.component.scss']
})
export class PlanCoatingFormComponent implements OnInit, OnDestroy {
  @ViewChild(ReturnModalComponent) returnModal!: ReturnModalComponent;

  processForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  plannings: any[] = [];
  /** Balances per plan id (cached; one item-balances call per plan). */
  planItemsCache = new Map<number, any[]>();
  /** Memoized row product options: a fresh array each cycle breaks the
      dropdown's search, so the reference must stay stable. */
  private prodOptionsMemo = new WeakMap<AbstractControl, { sig: string; arr: any[] }>();
  /** Deep-linked default plan for new rows (from Planning Detail). */
  defaultPlanningId: number | null = null;
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  isLoadingPlannings = false;
  processId?: number;
  isEditMode = false;
  showReturns = false;
  isLoadingReturns = false;
  itemReturns: Map<number, PowderCoatingReturn[]> = new Map();
  private destroy$ = new Subject<void>();

  get itemsFormArray(): FormArray {
    return this.processForm.get('items') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService,
    private customerService: CustomerService,
    private planningService: PlanningService,
    private planCoatingService: PlanCoatingService,
    private powderCoatingService: PowderCoatingService,
    private snackbar: SnackbarService,
    private modalService: ModalService,
    private encryptionService: EncryptionService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();
    this.loadPlannings();
    this.setupCustomerChange();

    // Encrypted id in URL (medonix pattern): decrypt before use.
    const rawId = this.route.snapshot.paramMap.get('id');
    if (rawId) {
      const id = Number(this.encryptionService.decrypt(rawId));
      if (!id) {
        this.snackbar.error('Invalid link');
        this.router.navigate(['/plan-coating']);
        return;
      }
      this.processId = id;
      this.isEditMode = true;
      this.loadProcess();
      return;
    }
    // Deep link from Planning Detail: new rows default to this plan.
    const rawPlanningId = this.route.snapshot.queryParamMap.get('planningId');
    const preselect = rawPlanningId ? Number(this.encryptionService.decrypt(rawPlanningId)) : NaN;
    if (preselect) {
      this.defaultPlanningId = preselect;
      this.ensurePlanItems([preselect], () => {});
    }
    this.addItem();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Encrypted id for URLs (medonix pattern); numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  private initializeForm(): void {
    this.processForm = this.fb.group({
      customerId: ['', [Validators.required]],
      // TRANSPORT_COATING_DATE: business date, defaults to today, editable.
      coatingDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      status: ['A'],
      items: this.fb.array([])
    });
  }

  // --- Plan-aware row helpers (mirrors plan-dispatch) ---

  rowPlanningId(itemGroup: AbstractControl): number | null {
    const v = itemGroup.get('planningId')?.value;
    return v ? Number(v) : null;
  }

  rowPlanItems(itemGroup: AbstractControl): any[] {
    const pid = this.rowPlanningId(itemGroup);
    return pid ? (this.planItemsCache.get(pid) || []) : [];
  }

  /** Product options for a row: its plan's coating products (or all products
      when no plan), plus the row's current product as a fallback so stored
      values always display. Memoized per row for dropdown stability. */
  rowProductOptions(itemGroup: AbstractControl): any[] {
    const pid = this.rowPlanningId(itemGroup);
    if (!pid) {
      return this.products;
    }
    const list = this.planItemsCache.get(pid) || [];
    const cur = Number(itemGroup.get('productId')?.value) || 0;
    const sig = [pid, cur, list.length,
      list.map(p => p.productId).join(','), this.products.length].join('|');
    const hit = this.prodOptionsMemo.get(itemGroup);
    if (hit && hit.sig === sig) {
      return hit.arr;
    }
    const arr = list.map(pi => ({ id: Number(pi.productId), name: pi.productName }));
    if (cur && !arr.some(o => o.id === cur)) {
      const fallback = (this.products || []).find((p: any) => Number(p.id) === cur);
      arr.push({ id: cur, name: fallback ? fallback.name : `Product #${cur}` });
    }
    this.prodOptionsMemo.set(itemGroup, { sig, arr });
    return arr;
  }

  balanceForRow(itemGroup: AbstractControl): string {
    const pid = this.rowPlanningId(itemGroup);
    const piId = itemGroup.get('planningItemId')?.value;
    if (!pid || !piId) {
      return '';
    }
    const pi = (this.planItemsCache.get(pid) || [])
      .find(p => Number(p.planningItemId ?? p.id) === Number(piId));
    if (!pi) {
      return '';
    }
    return `Emboss: ${pi.emboss ?? 0} · Coated: ${pi.coating ?? 0} · Can coat: ${pi.coatable ?? 0}`;
  }

  loadPlannings(): void {
    this.isLoadingPlannings = true;
    this.planningService.searchPlannings({ currentPage: 0, perPageRecord: 100, sortBy: 'id', sortDir: 'desc' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.plannings = response.data.content;
        }
        this.isLoadingPlannings = false;
      },
      error: () => {
        this.isLoadingPlannings = false;
      }
    });
  }

  /** Cached balances for plans (one backend call per plan). */
  private ensurePlanItems(ids: number[], done: () => void): void {
    const missing = ids.filter(id => id && !this.planItemsCache.has(id));
    if (!missing.length) {
      done();
      return;
    }
    let pending = missing.length;
    const check = () => {
      if (--pending === 0) {
        done();
      }
    };
    missing.forEach(id => {
      this.planCoatingService.getItemBalances(id).subscribe({
        next: (r) => {
          if (r.success) {
            this.planItemsCache.set(id, r.data || []);
          }
          check();
        },
        error: () => {
          this.snackbar.error('Failed to load planning products');
          check();
        }
      });
    });
  }

  onRowPlanningChange(itemGroup: AbstractControl): void {
    const pid = this.rowPlanningId(itemGroup);
    if (!pid) {
      // No plan → plain coating row: free product, no link.
      itemGroup.patchValue({ planningItemId: null }, { emitEvent: false });
      return;
    }
    this.ensurePlanItems([pid], () => {
      const list = this.planItemsCache.get(pid) || [];
      if (!list.length) {
        itemGroup.patchValue({ productId: '', planningItemId: null }, { emitEvent: false });
        this.snackbar.error('Selected plan has no products with Coating enabled');
        return;
      }
      // The product is always chosen by the user from the plan-constrained
      // dropdown — never auto-picked. Only keep an existing choice when it
      // still belongs to the newly selected plan, else clear it for a fresh pick.
      const prodId = Number(itemGroup.get('productId')?.value);
      const match = prodId ? list.find(p => Number(p.productId) === prodId) : null;
      if (prodId && !match) {
        itemGroup.patchValue({ productId: '', planningItemId: null }, { emitEvent: false });
        this.snackbar.error('Row product is not in the selected plan and was cleared');
      } else {
        itemGroup.patchValue(
          { planningItemId: match ? Number(match.planningItemId ?? match.id) : null },
          { emitEvent: false });
        this.autofillQuantityFromBalance(itemGroup);
      }
    });
  }

  onRowProductChange(itemGroup: AbstractControl): void {
    const pid = this.rowPlanningId(itemGroup);
    if (!pid) {
      itemGroup.patchValue({ planningItemId: null }, { emitEvent: false });
      return;
    }
    const prodId = Number(itemGroup.get('productId')?.value);
    const match = prodId
      ? (this.planItemsCache.get(pid) || []).find(p => Number(p.productId) === prodId)
      : null;
    itemGroup.patchValue(
      { planningItemId: match ? Number(match.planningItemId ?? match.id) : null },
      { emitEvent: false });
    this.autofillQuantityFromBalance(itemGroup);
  }

  /**
   * AUTOFILL_BALANCE_QTY: places the "Can coat" balance directly inside
   * Quantity (still editable). Only fills empty inputs — typed or stored
   * values are never overwritten. Emits so item totals recalculate exactly
   * like a keystroke.
   */
  private autofillQuantityFromBalance(itemGroup: AbstractControl): void {
    const qtyCtrl = itemGroup.get('quantity');
    if (!qtyCtrl || (qtyCtrl.value !== null && qtyCtrl.value !== '' && Number(qtyCtrl.value) !== 0)) {
      return;
    }
    const pid = this.rowPlanningId(itemGroup);
    const piId = itemGroup.get('planningItemId')?.value;
    if (!pid || !piId) {
      return;
    }
    const pi = (this.planItemsCache.get(pid) || [])
      .find(p => Number(p.planningItemId ?? p.id) === Number(piId));
    const balance = pi ? Number(pi.coatable ?? 0) : 0;
    if (balance > 0) {
      qtyCtrl.patchValue(balance);
    }
  }

  // --- Items (same shape as the old coating form + plan controls) ---

  addItem(itemData?: any): void {
    const itemGroup = this.fb.group({
      id: [itemData?.id || null],
      planningId: [itemData?.planningId ?? this.defaultPlanningId],
      planningItemId: [itemData?.planningItemId ?? null],
      productId: [itemData?.productId || '', [Validators.required]],
      quantity: [itemData?.quantity || '', [Validators.required, Validators.min(1)]],
      totalBags: [itemData?.totalBags || '', [Validators.required, Validators.min(1)]],
      unitPrice: [itemData?.unitPrice || 0, [Validators.required, Validators.min(0)]],
      totalAmount: [{ value: itemData?.totalAmount || '', disabled: true }],
      remarks: [itemData?.remarks || '']
    });

    this.itemsFormArray.push(itemGroup);
    const index = this.itemsFormArray.length - 1;

    itemGroup.get('quantity')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateItemTotal(index);
    });

    itemGroup.get('unitPrice')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateItemTotal(index);
    });

    itemGroup.get('planningId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.onRowPlanningChange(itemGroup);
    });

    itemGroup.get('productId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.onRowProductChange(itemGroup);
    });

    // Warm the plan cache so product options / balances render right away.
    const rowPid = this.rowPlanningId(itemGroup);
    if (rowPid) {
      this.ensurePlanItems([rowPid], () => {});
    }
    // The product stays empty until the user picks one — plan selection only
    // constrains the dropdown, it never fills the field.
  }

  removeItem(index: number): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const itemId = itemGroup.get('id')?.value;

    if (itemId && this.itemReturns.has(itemId) && this.itemReturns.get(itemId)!.length > 0) {
      this.snackbar.error('Cannot remove item with existing returns');
      return;
    }

    this.itemsFormArray.removeAt(index);
  }

  private calculateItemTotal(index: number): void {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const quantity = Number(itemGroup.get('quantity')?.value) || 0;
    const unitPrice = Number(itemGroup.get('unitPrice')?.value) || 0;
    const totalAmount = quantity * unitPrice;

    itemGroup.patchValue({
      totalAmount: totalAmount.toFixed(2)
    }, { emitEvent: false });
  }

  getGrandTotal(): number {
    return this.itemsFormArray.controls.reduce((total, control) => {
      const itemGroup = control as FormGroup;
      const quantity = Number(itemGroup.get('quantity')?.value) || 0;
      const unitPrice = Number(itemGroup.get('unitPrice')?.value) || 0;
      return total + (quantity * unitPrice);
    }, 0);
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.snackbar.error('Failed to load products');
        this.isLoadingProducts = false;
      }
    });
  }

  loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' }).subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to load customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  refreshProducts(): void {
    this.isLoadingProducts = true;
    this.productService.refreshProducts().subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
          this.snackbar.success('Products refreshed successfully');
        }
        this.isLoadingProducts = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
      }
    });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers().subscribe({
      next: (response) => {
        if (response.success) {
          this.customers = response.data;
          this.snackbar.success('Customers refreshed successfully');
        }
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.snackbar.error('Failed to refresh customers');
        this.isLoadingCustomers = false;
      }
    });
  }

  isFieldInvalid(control: AbstractControl | null): boolean {
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  isItemFieldInvalid(index: number, fieldName: string): boolean {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const field = itemGroup.get(fieldName);
    return this.isFieldInvalid(field);
  }

  getFieldError(control: AbstractControl | null, fieldName: string): string {
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['min']) return `${fieldName} must be at least ${control.errors['min'].min}`;
    }
    return '';
  }

  resetForm(): void {
    while (this.itemsFormArray.length > 0) {
      this.itemsFormArray.removeAt(0);
    }
    this.processForm.reset({ status: 'A' });
    this.addItem();
  }

  loadProcess(): void {
    this.loading = true;
    this.planCoatingService.getDetail(this.processId!).subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.data;

          while (this.itemsFormArray.length > 0) {
            this.itemsFormArray.removeAt(0);
          }

          this.processForm.patchValue({
            customerId: data.customerId,
            coatingDate: data.coatingDate
              ? formatDate(data.coatingDate, 'yyyy-MM-dd', 'en')
              : formatDate(new Date(), 'yyyy-MM-dd', 'en'),
            status: data.status || 'A'
          });

          if (data.items && data.items.length > 0) {
            data.items.forEach((item: any) => {
              this.addItem({
                id: item.id,
                productId: item.productId,
                planningId: item.planningId || null,
                planningItemId: item.planningItemId || null,
                quantity: item.quantity,
                totalBags: item.totalBags,
                unitPrice: item.unitPrice,
                totalAmount: item.totalAmount,
                remarks: item.remarks
              });
            });
          } else {
            this.addItem();
          }
        } else {
          this.snackbar.error('Failed to load process details');
          this.router.navigate(['/plan-coating']);
        }
        this.loading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load process details');
        this.loading = false;
        this.router.navigate(['/plan-coating']);
      }
    });
  }

  /** Client-side plan rule per row (re-resolved so submit always carries a
      valid link), plus the plain form checks from the old screen. */
  validateForm(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.processForm.get('customerId')?.value) {
      errors.push('Please select a customer');
    }
    if (this.itemsFormArray.length === 0) {
      errors.push('Please add at least one item');
    }

    this.itemsFormArray.controls.forEach((control, index) => {
      const itemGroup = control as FormGroup;
      const label = `item ${index + 1}`;
      const rowPid = this.rowPlanningId(itemGroup);

      if (!itemGroup.get('productId')?.value) {
        errors.push(`Please select product for ${label}`);
      }
      if (!itemGroup.get('quantity')?.value) {
        errors.push(`Please enter quantity for ${label}`);
      } else if (itemGroup.get('quantity')?.errors?.['min']) {
        errors.push(`Quantity must be greater than 0 for ${label}`);
      }
      if (!itemGroup.get('totalBags')?.value) {
        errors.push(`Please enter total bags for ${label}`);
      }
      if (itemGroup.get('unitPrice')?.value === null || itemGroup.get('unitPrice')?.value === ''
          || Number(itemGroup.get('unitPrice')?.value) < 0) {
        errors.push(`Please enter a valid unit price for ${label}`);
      }

      // Per-row plan rule: plan set → product must belong to that plan.
      if (rowPid) {
        const prodId = Number(itemGroup.get('productId')?.value);
        const match = prodId
          ? (this.planItemsCache.get(rowPid) || []).find(p => Number(p.productId) === prodId)
          : null;
        if (!match) {
          errors.push(`Please select a coating product of the chosen plan for ${label}`);
        } else {
          itemGroup.patchValue(
            { planningItemId: Number(match.planningItemId ?? match.id) },
            { emitEvent: false });
        }
      } else {
        itemGroup.patchValue({ planningItemId: null }, { emitEvent: false });
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const checked = this.validateForm();
    if (!checked.isValid) {
      this.markFormGroupTouched(this.processForm);
      this.snackbar.error(checked.errors[0]);
      return;
    }

    if (this.processForm.invalid) {
      this.markFormGroupTouched(this.processForm);
      this.snackbar.error('Please fix validation errors');
      return;
    }

    this.loading = true;
    const formValue = this.processForm.getRawValue();
    const requestData = {
      id: this.isEditMode ? this.processId : undefined,
      customerId: formValue.customerId,
      coatingDate: formValue.coatingDate || null,
      status: formValue.status,
      items: this.itemsFormArray.controls.map((control) => {
        const itemGroup = control as FormGroup;
        const itemValue = itemGroup.getRawValue();
        const item: any = {
          productId: Number(itemValue.productId),
          planningId: itemValue.planningId ? Number(itemValue.planningId) : null,
          planningItemId: itemValue.planningItemId ? Number(itemValue.planningItemId) : null,
          quantity: itemValue.quantity,
          totalBags: itemValue.totalBags,
          unitPrice: itemValue.unitPrice,
          remarks: itemValue.remarks || ''
        };

        if (this.isEditMode && itemValue.id) {
          item.id = itemValue.id;
        }

        return item;
      })
    };

    const request = this.isEditMode ?
      this.planCoatingService.updateProcess(requestData) :
      this.planCoatingService.createProcess(requestData);

    request.subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(`Process ${this.isEditMode ? 'updated' : 'created'} successfully`);
          this.router.navigate(['/plan-coating']);
        }
        this.loading = false;
      },
      error: (error: any) => {
        this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} process`);
        this.loading = false;
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    if (formGroup instanceof FormArray) {
      formGroup.controls.forEach(control => {
        control.markAsTouched();
        if (control instanceof FormGroup || control instanceof FormArray) {
          this.markFormGroupTouched(control);
        }
      });
    } else if (formGroup instanceof FormGroup) {
      Object.keys(formGroup.controls).forEach(key => {
        const control = formGroup.controls[key];
        control.markAsTouched();
        if (control instanceof FormGroup || control instanceof FormArray) {
          this.markFormGroupTouched(control);
        }
      });
    }
  }

  // --- Returns (same as the old screen; edit mode only) ---

  toggleReturns(): void {
    this.showReturns = !this.showReturns;
    if (this.showReturns && this.itemReturns.size === 0) {
      this.loadAllReturns();
    }
  }

  loadAllReturns(): void {
    if (!this.processId) return;

    this.isLoadingReturns = true;
    const itemIds: number[] = [];

    this.itemsFormArray.controls.forEach((control) => {
      const itemGroup = control as FormGroup;
      const itemId = itemGroup.get('id')?.value;
      if (itemId) {
        itemIds.push(itemId);
      }
    });

    if (itemIds.length === 0) {
      this.isLoadingReturns = false;
      return;
    }

    let completed = 0;
    itemIds.forEach(itemId => {
      this.powderCoatingService.getProcessItemReturns(itemId).subscribe({
        next: (response) => {
          if (response.success) {
            this.itemReturns.set(itemId, response.data || []);
          }
          completed++;
          if (completed === itemIds.length) {
            this.isLoadingReturns = false;
          }
        },
        error: () => {
          completed++;
          if (completed === itemIds.length) {
            this.isLoadingReturns = false;
          }
        }
      });
    });
  }

  loadItemReturns(itemId: number): PowderCoatingReturn[] {
    return this.itemReturns.get(itemId) || [];
  }

  getTotalReturnsForItem(itemId: number): number {
    const returns = this.itemReturns.get(itemId) || [];
    return returns.reduce((sum, ret) => sum + ret.returnQuantity, 0);
  }

  deleteReturn(returnId: number, itemId: number): void {
    if (confirm('Are you sure you want to delete this return?')) {
      this.isLoadingReturns = true;
      this.powderCoatingService.deleteReturn(returnId).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Return deleted successfully');
            this.powderCoatingService.getProcessItemReturns(itemId).subscribe({
              next: (resp) => {
                if (resp.success) {
                  this.itemReturns.set(itemId, resp.data || []);
                }
                this.isLoadingReturns = false;
              },
              error: () => {
                this.isLoadingReturns = false;
              }
            });
          } else {
            this.isLoadingReturns = false;
          }
        },
        error: () => {
          this.snackbar.error('Failed to delete return');
          this.isLoadingReturns = false;
        }
      });
    }
  }

  openReturnModal(processItemId: number): void {
    if (processItemId) {
      this.modalService.open('return', processItemId);
    } else {
      this.snackbar.error('Unable to open return modal');
    }
  }

  getProductName(productId: number): string {
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : '';
  }

  private setupCustomerChange(): void {
    this.processForm.get('customerId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(customerId => {
      if (customerId) {
        this.customerService.getCustomerCoatingPrice(customerId).subscribe({
          next: (response: any) => {
            if (response.success) {
              const unitPrice = response.data?.coatingUnitPrice || 0;
              this.itemsFormArray.controls.forEach((control) => {
                const itemGroup = control as FormGroup;
                if (!itemGroup.get('id')?.value) {
                  itemGroup.patchValue({ unitPrice });
                }
              });
            }
          },
          error: () => {
            // Silently fail, don't show error for price lookup
          }
        });
      }
    });
  }
}
