import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, FormControl } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { PlanDispatchService } from '../../../services/plan-dispatch.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PlanSelectComponent } from '../../../shared/components/plan-select/plan-select.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PriceService } from '../../../services/price.service';
import { PageAccessService } from '../../../services/page-access.service';
import { distinctUntilChanged } from 'rxjs/operators';
import { debounceTime } from 'rxjs/operators';

interface BagFormGroup extends FormGroup {
  controls: {
    id: FormControl<string | null>;
    weight: FormControl<number | null>;
    numberOfBags: FormControl<number | null>;
    items: FormArray;
  };
}

/**
 * PLAN_DISPATCH_ITEM form: same transport/bags/prices/PDF behaviour as the old
 * Transport screen (untouched), plus a per-ROW Plan + Product option.
 * Row without plan = existing-dispatch row (any product). Row with plan =
 * product must belong to that plan; saving auto-creates DISPATCH progress
 * entries (reversed on edit/delete). Rows may span several plans.
 */
@Component({
  selector: 'app-plan-dispatch-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    PlanSelectComponent,
    LoaderComponent,
    RouterLink,
    ConfirmModalComponent
  ],
  templateUrl: './plan-dispatch-form.component.html',
  styleUrls: ['./plan-dispatch-form.component.scss']
})
export class PlanDispatchFormComponent implements OnInit, OnDestroy {
  transportForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  /** Balances per plan id (cached; one item-balances call per plan). */
  planItemsCache = new Map<number, any[]>();
  /** Memoized row product options: the dropdown re-syncs on every new array
      reference, so the reference must stay stable or typing/search breaks. */
  private prodOptionsMemo = new WeakMap<AbstractControl, { sig: string; arr: any[] }>();
  /** Deep-linked default plan for newly added rows (from Planning Detail). */
  defaultPlanningId: number | null = null;
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
  showDeleteBagModal = false;
  showDeleteItemModal = false;
  deleteBagIndex: number | null = null;
  deleteItemIndices: { bagIndex: number; itemIndex: number } | null = null;
  transportId: number | null = null;
  isEditMode = false;
  transportSummary: any | null = null;
  isPrinting = false;
  submitted = false;
  private pendingItemPlanningMap: Record<string, number> = {};
  private pendingItemPlanningIdMap: Record<string, number> = {};
  private destroy$ = new Subject<void>();

  /** Hide purchase/sale amounts on edit when role has HIDE_TRANSPORT_FINANCIALS. */
  get hideTransportFinancials(): boolean {
    return this.isEditMode && this.pageAccessService.shouldHideTransportFinancials();
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private customerService: CustomerService,
    private planDispatchService: PlanDispatchService,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService,
    private priceService: PriceService,
    private pageAccessService: PageAccessService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();

    // Encrypted id in URL (medonix pattern): decrypt before use.
    const rawId = this.route.snapshot.paramMap.get('id');
    if (rawId) {
      const id = Number(this.encryptionService.decrypt(rawId));
      if (!id) {
        this.snackbar.error('Invalid link');
        this.router.navigate(['/plan-dispatch']);
        return;
      }
      this.transportId = id;
      this.isEditMode = true;
      this.loadDispatchDetail();
      return;
    }
    // Deep link from Planning Detail: new rows default to this plan.
    const rawPlanningId = this.route.snapshot.queryParamMap.get('planningId');
    const preselect = rawPlanningId ? Number(this.encryptionService.decrypt(rawPlanningId)) : NaN;
    if (preselect) {
      this.defaultPlanningId = preselect;
      this.ensurePlanItems([preselect], () => {
        if (this.bags.length === 0) {
          this.addBag();
        }
      });
    }
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
    this.transportForm = this.fb.group({
      customerId: ['', [Validators.required]],
      // TRANSPORT_COATING_DATE: business date, defaults to today, editable.
      transportDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      bags: this.fb.array([])
    });
  }

  get bags(): FormArray {
    return this.transportForm.get('bags') as FormArray;
  }

  rowPlanningId(itemGroup: AbstractControl): number | null {
    const v = itemGroup.get('planningId')?.value;
    return v ? Number(v) : null;
  }

  rowPlanItems(itemGroup: AbstractControl): any[] {
    const pid = this.rowPlanningId(itemGroup);
    return pid ? (this.planItemsCache.get(pid) || []) : [];
  }

  /** Product options for a row: its plan's products (ids normalized to numbers
      so the dropdown's strict matching works), plus the row's current product
      when it is missing from the plan so stored/legacy values still display.
      Reference memoized per row — a fresh array each cycle breaks the dropdown. */
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
    const pi = (this.planItemsCache.get(pid) || []).find(p => Number(p.planningItemId ?? p.id) === Number(piId));
    if (!pi) {
      return '';
    }
    return `Pack: ${pi.packing ?? 0} · Disp: ${pi.dispatch ?? 0} · Can dispatch: ${pi.dispatchable ?? 0}`;
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
      this.planDispatchService.getItemBalances(id).subscribe({
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
      // No plan → existing-dispatch row: free product, no link.
      itemGroup.patchValue({ planningItemId: null }, { emitEvent: false });
      return;
    }
    this.ensurePlanItems([pid], () => {
      const prodCtrl = itemGroup.get('productId');
      if (!prodCtrl?.value) {
        // Nothing chosen yet → default to the plan's first product so the
        // row is immediately valid and shows a label, not a placeholder.
        const list = this.planItemsCache.get(pid) || [];
        if (list.length) {
          itemGroup.patchValue({
            productId: Number(list[0].productId),
            planningItemId: Number(list[0].planningItemId ?? list[0].id)
          }, { emitEvent: false });
          this.autofillQuantityFromBalance(itemGroup);
          return;
        }
      }
      // Keep the product when it belongs to the newly picked plan, else clear it.
      const prodId = Number(itemGroup.get('productId')?.value);
      const match = prodId
        ? (this.planItemsCache.get(pid) || []).find(p => Number(p.productId) === prodId)
        : null;
      if (prodId && !match) {
        itemGroup.patchValue({ productId: '', planningItemId: null }, { emitEvent: false });
        this.snackbar.error('Row product is not in the selected plan and was cleared');
      } else {
        itemGroup.patchValue(
          { planningItemId: match ? Number(match.planningItemId ?? match.id) : null },
          { emitEvent: false });
        // Balances just arrived for an already-chosen product (picked during
        // load) — fill the empty Quantity now, it was skipped earlier.
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
    itemGroup.patchValue({ planningItemId: match ? Number(match.planningItemId ?? match.id) : null }, { emitEvent: false });
    this.autofillQuantityFromBalance(itemGroup);
  }

  /**
   * AUTOFILL_BALANCE_QTY: places the "Can dispatch" balance directly inside
   * Quantity (still editable). Only fills empty inputs — typed or stored
   * values are never overwritten. Emits so per-bag totals recalculate exactly
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
    const balance = pi ? Number(pi.dispatchable ?? 0) : 0;
    if (balance > 0) {
      qtyCtrl.patchValue(balance);
    }
  }

  addBag(): void {
    const bagGroup = this.createBagFormGroup();
    this.bags.push(bagGroup);

    const bagIndex = this.bags.length - 1;
    this.setupBagCalculations(bagIndex);

    this.addItem(bagIndex);
  }

  removeBag(bagIndex: number): void {
    this.deleteBagIndex = bagIndex;
    this.showDeleteBagModal = true;
  }

  getBagItems(bagIndex: number): FormArray {
    return this.bags.at(bagIndex).get('items') as FormArray;
  }

  addItem(bagIndex: number): void {
    const items = this.getBagItems(bagIndex);
    const newItem: FormGroup = this.fb.group({
      id: [null],
      planningId: [this.defaultPlanningId],
      productId: ['', [Validators.required]],
      planningItemId: [null],
      quantity: ['', [Validators.required, Validators.min(1)]],
      originalQuantity: [''],
      totalQuantity: [''],
      remarks: [''],
      purchaseUnitPrice: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      purchaseDiscountAmount: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscountPrice: [0, [Validators.required, Validators.min(0)]],
      saleUnitPrice: [0, [Validators.required, Validators.min(0)]],
      saleDiscount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      saleDiscountAmount: [0, [Validators.required, Validators.min(0)]],
      saleDiscountPrice: [0, [Validators.required, Validators.min(0)]]
    });

    newItem.get('planningId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.onRowPlanningChange(newItem);
    });
    newItem.get('productId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.onRowProductChange(newItem);
      this.setupPriceFetching(newItem);
    });

    items.push(newItem);

    // Default new rows to the deep-linked plan's first product.
    if (this.defaultPlanningId) {
      this.ensurePlanItems([this.defaultPlanningId], () => {
        if (!newItem.get('productId')?.value) {
          const list = this.planItemsCache.get(this.defaultPlanningId!) || [];
          if (list.length) {
            newItem.patchValue({
              productId: Number(list[0].productId),
              planningItemId: Number(list[0].planningItemId ?? list[0].id)
            }, { emitEvent: false });
            this.autofillQuantityFromBalance(newItem);
          }
        }
      });
    }

    this.setupItemCalculations(bagIndex, items.length - 1);
    this.setupDiscountCalculations(bagIndex, items.length - 1);

    this.updateItemQuantities(bagIndex, items.length - 1);
  }

  private setupDiscountCalculations(bagIndex: number, itemIndex: number): void {
    const itemGroup = this.getBagItems(bagIndex).at(itemIndex);

    ['purchaseUnitPrice', 'purchaseDiscount', 'purchaseDiscountAmount'].forEach(field => {
      itemGroup.get(field)?.valueChanges
        .pipe(
          distinctUntilChanged(),
          debounceTime(300)
        )
        .subscribe((value) => {
          if (value !== null && value !== undefined) {
            const control = itemGroup.get(field);
            if (control) {
              control.markAsDirty();
              control.markAsTouched();
            }
            this.calculateDiscount(bagIndex, itemIndex, 'purchase');
          }
        });
    });

    ['saleUnitPrice', 'saleDiscount', 'saleDiscountAmount'].forEach(field => {
      itemGroup.get(field)?.valueChanges
        .pipe(
          distinctUntilChanged(),
          debounceTime(300)
        )
        .subscribe((value) => {
          if (value !== null && value !== undefined) {
            const control = itemGroup.get(field);
            if (control) {
              control.markAsDirty();
              control.markAsTouched();
            }
            this.calculateDiscount(bagIndex, itemIndex, 'sale');
          }
        });
    });
  }

  private calculateDiscount(bagIndex: number, itemIndex: number, type: 'purchase' | 'sale'): void {
    const bag = this.bags.at(bagIndex) as BagFormGroup;
    const numberOfBags = bag.get('numberOfBags')?.value || 1;
    const itemGroup = this.getBagItems(bagIndex).at(itemIndex);
    const prefix = type === 'purchase' ? 'purchase' : 'sale';

    const values = {
      quantity: (Number(itemGroup.get('quantity')?.value) || 0) * numberOfBags,
      unitPrice: Number(itemGroup.get(`${prefix}UnitPrice`)?.value) || 0,
      discountPercentage: Number(itemGroup.get(`${prefix}Discount`)?.value) || 0,
      discountAmount: Number(itemGroup.get(`${prefix}DiscountAmount`)?.value) || 0,
      finalPrice: 0
    };

    const totalPrice = values.quantity * values.unitPrice;

    const discountControl = itemGroup.get(`${prefix}Discount`);
    const discountAmountControl = itemGroup.get(`${prefix}DiscountAmount`);
    const unitPriceControl = itemGroup.get(`${prefix}UnitPrice`);

    if (discountControl?.dirty && discountControl.touched) {
      values.discountPercentage = Math.min(Math.max(values.discountPercentage, 0), 100);
      values.discountAmount = (totalPrice * values.discountPercentage) / 100;
      values.finalPrice = totalPrice - values.discountAmount;
    }
    else if (discountAmountControl?.dirty && discountAmountControl.touched) {
      values.discountAmount = Math.min(Math.max(values.discountAmount, 0), totalPrice);
      values.discountPercentage = totalPrice > 0 ? (values.discountAmount / totalPrice) * 100 : 0;
      values.finalPrice = totalPrice - values.discountAmount;
    }
    else if (unitPriceControl?.dirty && unitPriceControl.touched) {
      values.discountAmount = (totalPrice * values.discountPercentage) / 100;
      values.finalPrice = totalPrice - values.discountAmount;
    }
    else {
      values.discountAmount = (totalPrice * values.discountPercentage) / 100;
      values.finalPrice = totalPrice - values.discountAmount;
    }

    values.finalPrice = Math.max(0, Number(values.finalPrice.toFixed(2)));
    values.discountAmount = Math.max(0, Number(values.discountAmount.toFixed(2)));
    values.discountPercentage = Math.max(0, Math.min(Number(values.discountPercentage.toFixed(2)), 100));

    itemGroup.patchValue({
      [`${prefix}DiscountAmount`]: values.discountAmount,
      [`${prefix}Discount`]: values.discountPercentage,
      [`${prefix}DiscountPrice`]: values.finalPrice
    }, { emitEvent: false });
  }

  removeItem(bagIndex: number, itemIndex: number): void {
    this.deleteItemIndices = { bagIndex, itemIndex };
    this.showDeleteItemModal = true;
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

  isFieldInvalid(control: AbstractControl | null): boolean {
    if (!control) return false;
    return control.invalid;
  }

  getFieldError(field: any): string {
    if (!field) return '';

    if (field.hasError('required')) {
      return 'This field is required';
    }

    if (field.hasError('min')) {
      const min = field.errors?.['min'].min;
      return `Value must be greater than ${min}`;
    }

    return '';
  }

  getCustomErrorMessage(field: any, fieldName: string): string {
    if (!field?.errors) return '';

    if (field.hasError('required')) {
      return `Please enter ${fieldName}`;
    }

    if (field.hasError('min')) {
      const min = field.errors?.['min'].min;
      if (fieldName === 'weight') {
        return `Weight must be greater than ${min}kg`;
      }
      return `${fieldName} must be greater than ${min}`;
    }

    return '';
  }

  validateForm(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.transportForm.get('customerId')?.value) {
      errors.push('Please select a customer');
    }

    if (this.bags.length === 0) {
      errors.push('Please add at least one bag');
    } else {
      this.bags.controls.forEach((bag, bagIndex) => {
        if (!bag.get('weight')?.value) {
          errors.push(`Please enter weight for Bag #${bagIndex + 1}`);
        } else if (bag.get('weight')?.errors?.['min']) {
          errors.push(`Weight must be greater than 0kg for Bag #${bagIndex + 1}`);
        }

        const items = this.getBagItems(bagIndex);
        if (items.length === 0) {
          errors.push(`Please add at least one item in Bag #${bagIndex + 1}`);
        } else {
          items.controls.forEach((item, itemIndex) => {
            const label = `item ${itemIndex + 1} in Bag #${bagIndex + 1}`;
            const rowPid = this.rowPlanningId(item);
            if (!item.get('productId')?.value) {
              errors.push(`Please select product for ${label}`);
            }
            if (!item.get('quantity')?.value) {
              errors.push(`Please enter quantity for ${label}`);
            } else if (item.get('quantity')?.errors?.['min']) {
              errors.push(`Quantity must be greater than 0 for ${label}`);
            }
            // Per-row plan rule: plan set → product must belong to that plan
            // (re-resolved here so submit always carries a valid link).
            if (rowPid) {
              const prodId = Number(item.get('productId')?.value);
              const match = prodId
                ? (this.planItemsCache.get(rowPid) || []).find(p => Number(p.productId) === prodId)
                : null;
              if (!match) {
                errors.push(`Please select a product of the chosen plan for ${label}`);
              } else {
                item.patchValue(
                  { planningItemId: Number(match.planningItemId ?? match.id) },
                  { emitEvent: false });
              }
            } else {
              item.patchValue({ planningItemId: null }, { emitEvent: false });
            }
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.submitted = true;

    const checked = this.validateForm();
    if (!checked.isValid) {
      this.markAllFieldsAsTouched(this.transportForm);
      this.snackbar.error(checked.errors[0]);
      return;
    }

    if (this.transportForm.invalid) {
      this.markAllFieldsAsTouched(this.transportForm);
      this.snackbar.error('Please fill in all required fields correctly');
      return;
    }

    this.loading = true;
    const formValue = this.transportForm.getRawValue();
    const payload = {
      id: this.isEditMode ? this.transportId : undefined,
      customerId: formValue.customerId,
      transportDate: formValue.transportDate || null,
      bags: formValue.bags.map((bag: any) => ({
        id: bag.id,
        weight: bag.weight,
        numberOfBags: bag.numberOfBags,
        totalBagWeight: bag.totalBagWeight,
        items: bag.items.map((item: any) => ({
          id: item.id,
          productId: Number(item.productId),
          planningId: item.planningId ? Number(item.planningId) : null,
          planningItemId: item.planningItemId ? Number(item.planningItemId) : null,
          quantity: item.totalQuantity,
          remarks: item.remarks || '',
          purchaseUnitPrice: item.purchaseUnitPrice,
          purchaseDiscount: item.purchaseDiscount,
          purchaseDiscountAmount: item.purchaseDiscountAmount,
          purchaseDiscountPrice: item.purchaseDiscountPrice,
          saleUnitPrice: item.saleUnitPrice,
          saleDiscount: item.saleDiscount,
          saleDiscountAmount: item.saleDiscountAmount,
          saleDiscountPrice: item.saleDiscountPrice
        }))
      }))
    };

    const apiCall = this.isEditMode ?
      this.planDispatchService.updateDispatch(payload) :
      this.planDispatchService.createDispatch(payload);

    apiCall.subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message || `Dispatch ${this.isEditMode ? 'updated' : 'created'} successfully`);
          this.router.navigate(['/plan-dispatch']);
        }
        this.loading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} dispatch`);
        this.loading = false;
      }
    });
  }

  private markAllFieldsAsTouched(formGroup: FormGroup | FormArray): void {
    Object.values(formGroup.controls).forEach(control => {
      if (control instanceof FormControl) {
        control.markAsTouched();
        control.updateValueAndValidity();
      } else if (control instanceof FormGroup) {
        this.markAllFieldsAsTouched(control);
      } else if (control instanceof FormArray) {
        this.markAllFieldsAsTouched(control);
        control.controls.forEach(ctrl => {
          if (ctrl instanceof FormGroup) {
            this.markAllFieldsAsTouched(ctrl);
          }
        });
      }
    });
  }

  resetForm(): void {
    this.transportForm.reset();
    while (this.bags.length) {
      this.bags.removeAt(0);
    }
  }

  onDeleteBag(bagIndex: number): void {
    this.deleteBagIndex = bagIndex;
    this.showDeleteBagModal = true;
  }

  onDeleteItem(bagIndex: number, itemIndex: number): void {
    this.deleteItemIndices = { bagIndex, itemIndex };
    this.showDeleteItemModal = true;
  }

  confirmDeleteBag(): void {
    if (this.deleteBagIndex !== null) {
      this.bags.removeAt(this.deleteBagIndex);
      this.showDeleteBagModal = false;
      this.deleteBagIndex = null;
    }
  }

  confirmDeleteItem(): void {
    if (this.deleteItemIndices) {
      const { bagIndex, itemIndex } = this.deleteItemIndices;
      const items = this.getBagItems(bagIndex);
      if (items.length > 1) {
        items.removeAt(itemIndex);
      }
      this.showDeleteItemModal = false;
      this.deleteItemIndices = null;
    }
  }

  cancelDelete(): void {
    this.showDeleteBagModal = false;
    this.showDeleteItemModal = false;
    this.deleteBagIndex = null;
    this.deleteItemIndices = null;
  }

  private loadDispatchDetail(): void {
    if (!this.transportId) return;

    this.loading = true;
    this.planDispatchService.getDispatchDetail(this.transportId).subscribe({
      next: (response) => {
        if (response.success) {
          this.pendingItemPlanningMap = response.data.itemPlanningMap || {};
          this.pendingItemPlanningIdMap = response.data.itemPlanningIdMap || {};
          this.populateForm(response.data.transport);
          // Prefetch every linked plan, then stamp rows with their links.
          const planIds = [...new Set(Object.values(this.pendingItemPlanningIdMap).map(Number))]
            .filter(id => Number.isFinite(id) && id > 0);
          if (planIds.length) {
            this.ensurePlanItems(planIds, () => {
              this.applyItemPlanningMaps();
              this.loading = false;
            });
          } else {
            this.loading = false;
          }
        } else {
          this.loading = false;
        }
      },
      error: () => {
        this.snackbar.error('Failed to load dispatch details');
        this.loading = false;
      }
    });
  }

  private applyItemPlanningMaps(): void {
    this.bags.controls.forEach(bag => {
      (bag.get('items') as FormArray).controls.forEach(item => {
        const rowId = item.get('id')?.value;
        const key = rowId !== null && rowId !== undefined ? String(rowId) : null;
        const piId = key ? this.pendingItemPlanningMap[key] : null;
        const pId = key ? this.pendingItemPlanningIdMap[key] : null;
        if (piId && pId) {
          item.patchValue({ planningId: Number(pId), planningItemId: Number(piId) }, { emitEvent: false });
        } else {
          this.onRowProductChange(item);
        }
      });
    });
  }

  private populateForm(data: any): void {
    if (!this.products.length) {
      this.snackbar.error('Products not loaded yet');
      return;
    }

    while (this.bags.length) {
      this.bags.removeAt(0);
    }

    this.transportForm.patchValue({
      customerId: data.customerId,
      transportDate: data.transportDate
        ? formatDate(data.transportDate, 'yyyy-MM-dd', 'en')
        : formatDate(new Date(), 'yyyy-MM-dd', 'en')
    });

    data.bags.forEach((bag: any) => {
      const bagGroup = this.fb.group({
        id: [bag.id],
        weight: [bag.weight, [Validators.required, Validators.min(0.01)]],
        numberOfBags: [bag.numberOfBags, [Validators.required, Validators.min(1)]],
        totalBagWeight: [bag.totalBagWeight],
        items: this.fb.array([])
      });
      this.bags.push(bagGroup);
      const currentBagIndex = this.bags.length - 1;

      bag.items.forEach((item: any) => {
        const itemGroup = this.fb.group({
          id: [item.id],
          planningId: [null],
          productId: [item.productId !== null && item.productId !== undefined ? Number(item.productId) : '', [Validators.required]],
          planningItemId: [null],
          quantity: [item.quantity, [Validators.required, Validators.min(1)]],
          totalQuantity: [item.totalQuantity, [Validators.required, Validators.min(1)]],
          remarks: [item.remarks || ''],
          purchaseUnitPrice: [item.purchase.unitPrice, [Validators.required, Validators.min(0)]],
          purchaseDiscount: [item.purchase.discount, [Validators.required, Validators.min(0)]],
          purchaseDiscountAmount: [item.purchase.discountAmount, [Validators.required, Validators.min(0)]],
          purchaseDiscountPrice: [item.purchase.discountPrice, [Validators.required, Validators.min(0)]],
          saleUnitPrice: [item.sale.unitPrice, [Validators.required, Validators.min(0)]],
          saleDiscount: [item.sale.discount, [Validators.required, Validators.min(0)]],
          saleDiscountAmount: [item.sale.discountAmount, [Validators.required, Validators.min(0)]],
          saleDiscountPrice: [item.sale.discountPrice, [Validators.required, Validators.min(0)]]
        });

        const itemsArray = this.getBagItems(currentBagIndex);
        itemsArray.push(itemGroup);

        itemGroup.get('planningId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
          this.onRowPlanningChange(itemGroup);
        });
        itemGroup.get('productId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
          this.onRowProductChange(itemGroup);
          this.setupPriceFetching(itemGroup);
        });

        this.setupItemCalculations(currentBagIndex, itemsArray.length - 1);
        this.setupDiscountCalculations(currentBagIndex, itemsArray.length - 1);
      });

      this.setupBagCalculations(currentBagIndex);
    });

    this.transportSummary = {
      totalBags: data.totalBags,
      totalWeight: data.totalWeight,
      totalSaleAmount: data.summary.totalSaleAmount,
      totalProfit: data.summary.totalProfit,
      totalPurchaseAmount: data.summary.totalPurchaseAmount,
      createdAt: new Date(data.createdAt)
    };

    this.transportForm.updateValueAndValidity();
  }

  calculateTotalWeight(): number {
    return this.bags.controls.reduce((total, bag) => {
      return total + this.calculateTotalBagWeight(this.bags.controls.indexOf(bag));
    }, 0);
  }

  private getErrorMessage(control: AbstractControl, fieldName: string): string {
    if (control.hasError('required')) {
      return `${fieldName} is required`;
    }
    if (control.hasError('min')) {
      return `${fieldName} must be greater than ${control.errors?.['min'].min}`;
    }
    return '';
  }

  private setupPriceFetching(item: AbstractControl): void {
    const productControl = item.get('productId');
    const customerId = this.transportForm.get('customerId')?.value;

    if (productControl && customerId) {
      this.priceService.getLatestPrices({
        productId: productControl.value,
        customerId: customerId
      }).subscribe({
        next: (response) => {
          if (response.success) {
            item.patchValue({
              purchaseUnitPrice: response.data.lastPurchasePrice || 0,
              saleUnitPrice: response.data.lastSalePrice || 0
            }, { emitEvent: true });
          }
        },
        error: () => {
          this.snackbar.error('Failed to fetch latest prices');
        }
      });
    }
  }

  onPrint(): void {
    if (!this.transportId || this.isPrinting || this.loading) return;

    this.isPrinting = true;
    this.planDispatchService.generatePdf(this.transportId).subscribe({
      next: (response) => {
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isPrinting = false;
      },
      error: () => {
        this.snackbar.error('Failed to generate PDF');
        this.isPrinting = false;
      }
    });
  }

  private createBagFormGroup(): FormGroup {
    return this.fb.group({
      id: [''],
      weight: [0.01, [Validators.required, Validators.min(0.01)]],
      numberOfBags: [1, [Validators.required, Validators.min(1)]],
      totalBagWeight: [0],
      items: this.fb.array([])
    });
  }

  getBagTitle(bagIndex: number): string {
    const bag = this.bags.at(bagIndex) as FormGroup;
    const numberOfBags = bag.get('numberOfBags')?.value || 1;

    let startNumber = this.calculateStartNumber(bagIndex);
    let endNumber = startNumber + numberOfBags - 1;

    return numberOfBags === 1 ?
      `Bag #${startNumber}` :
      `Bags #${startNumber}-${endNumber}`;
  }

  private calculateStartNumber(bagIndex: number): number {
    let startNumber = 1;
    for (let i = 0; i < bagIndex; i++) {
      const bag = this.bags.at(i) as FormGroup;
      startNumber += bag.get('numberOfBags')?.value || 1;
    }
    return startNumber;
  }

  calculateTotalBagWeight(bagIndex: number): number {
    const bag = this.bags.at(bagIndex) as BagFormGroup;
    const weight = bag.get('weight')?.value || 0;
    const numberOfBags = bag.get('numberOfBags')?.value || 1;
    return weight * numberOfBags;
  }

  private setupBagCalculations(bagIndex: number): void {
    const bag = this.bags.at(bagIndex) as FormGroup;

    this.updateBagCalculations(bagIndex);

    ['weight', 'numberOfBags'].forEach(field => {
      bag.get(field)?.valueChanges.subscribe(() => {
        this.updateBagCalculations(bagIndex);
      });
    });
  }

  private updateBagCalculations(bagIndex: number): void {
    const bag = this.bags.at(bagIndex) as FormGroup;
    const numberOfBags = bag.get('numberOfBags')?.value || 1;

    const totalBagWeight = this.calculateTotalBagWeight(bagIndex);
    bag.patchValue({ totalBagWeight }, { emitEvent: false });

    const items = this.getBagItems(bagIndex);
    items.controls.forEach((item, itemIndex) => {
      const originalQuantity = item.get('quantity')?.value || 0;
      const totalQuantity = originalQuantity * numberOfBags;

      item.patchValue({
        originalQuantity: originalQuantity,
        totalQuantity: totalQuantity
      }, { emitEvent: false });

      this.calculateDiscount(bagIndex, itemIndex, 'purchase');
      this.calculateDiscount(bagIndex, itemIndex, 'sale');
    });
  }

  private setupItemCalculations(bagIndex: number, itemIndex: number): void {
    const bag = this.bags.at(bagIndex) as FormGroup;
    const item = this.getBagItems(bagIndex).at(itemIndex);

    item.get('quantity')?.valueChanges.subscribe(() => {
      this.updateItemQuantities(bagIndex, itemIndex);
    });

    bag.get('numberOfBags')?.valueChanges.subscribe(() => {
      this.updateItemQuantities(bagIndex, itemIndex);
    });
  }

  private updateItemQuantities(bagIndex: number, itemIndex: number): void {
    const bag = this.bags.at(bagIndex) as FormGroup;
    const item = this.getBagItems(bagIndex).at(itemIndex);

    const numberOfBags = bag.get('numberOfBags')?.value || 1;
    const originalQuantity = item.get('quantity')?.value || 0;
    const totalQuantity = originalQuantity * numberOfBags;

    item.patchValue({
      originalQuantity: originalQuantity,
      totalQuantity: totalQuantity
    }, { emitEvent: false });

    this.calculateDiscount(bagIndex, itemIndex, 'purchase');
    this.calculateDiscount(bagIndex, itemIndex, 'sale');
  }

  private createItemFormGroup(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      planningId: [this.defaultPlanningId],
      planningItemId: [null],
      quantity: [1, [Validators.required, Validators.min(1)]],
      remarks: [''],
      purchaseUnitPrice: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      purchaseDiscountAmount: [0, [Validators.required, Validators.min(0)]],
      purchaseDiscountPrice: [0],
      saleUnitPrice: [0, [Validators.required, Validators.min(0)]],
      saleDiscount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      saleDiscountAmount: [0, [Validators.required, Validators.min(0)]],
      saleDiscountPrice: [0],
      totalQuantity: [0],
      originalQuantity: [0]
    });
  }
}
