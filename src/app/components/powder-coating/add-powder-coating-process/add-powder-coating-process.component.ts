import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { CustomerService } from '../../../services/customer.service';
import { PowderCoatingService } from '../../../services/powder-coating.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PowderCoatingReturn } from '../../../models/powder-coating.model';
import { ReturnModalComponent } from '../return-modal/return-modal.component';
import { ModalService } from '../../../services/modal.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-add-powder-coating-process',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    LoaderComponent,
    RouterLink,
    ReturnModalComponent
  ],
  templateUrl: './add-powder-coating-process.component.html',
  styleUrls: ['./add-powder-coating-process.component.scss']
})
export class AddPowderCoatingProcessComponent implements OnInit, OnDestroy {
  @ViewChild(ReturnModalComponent) returnModal!: ReturnModalComponent;
  
  processForm!: FormGroup;
  products: any[] = [];
  customers: any[] = [];
  loading = false;
  isLoadingProducts = false;
  isLoadingCustomers = false;
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
    private powderCoatingService: PowderCoatingService,
    private snackbar: SnackbarService,
    private modalService: ModalService
  ) {
    this.initializeForm();
    this.processId = this.route.snapshot.params['id'];
    this.isEditMode = !!this.processId;
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();
    this.setupCustomerChange();
    if (this.isEditMode) {
      this.loadProcess();
    } else {
      this.addItem();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.processForm = this.fb.group({
      customerId: ['', [Validators.required]],
      status: ['A'],
      items: this.fb.array([])
    });
  }

  addItem(itemData?: any): void {
    const itemGroup = this.fb.group({
      id: [itemData?.id || null],
      productId: [itemData?.productId || '', [Validators.required]],
      quantity: [itemData?.quantity || '', [Validators.required, Validators.min(1)]],
      totalBags: [itemData?.totalBags || '', [Validators.required, Validators.min(1)]],
      unitPrice: [itemData?.unitPrice || 0, [Validators.required, Validators.min(0)]],
      totalAmount: [{ value: itemData?.totalAmount || '', disabled: true }],
      remarks: [itemData?.remarks || '']
    });

    this.itemsFormArray.push(itemGroup);
    const index = this.itemsFormArray.length - 1;

    // Setup total amount calculation for this item
    itemGroup.get('quantity')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateItemTotal(index);
    });

    itemGroup.get('unitPrice')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateItemTotal(index);
    });
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
    this.powderCoatingService.getProcess(this.processId!).subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.data;
          
          // Clear existing items
          while (this.itemsFormArray.length > 0) {
            this.itemsFormArray.removeAt(0);
          }

          // Set customer and status
          this.processForm.patchValue({
            customerId: data.customerId,
            status: data.status || 'A'
          });

          // Add items
          if (data.items && data.items.length > 0) {
            data.items.forEach((item: any) => {
              this.addItem({
                id: item.id,
                productId: item.productId,
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
          this.router.navigate(['/powder-coating-process']);
        }
        this.loading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load process details');
        this.loading = false;
        this.router.navigate(['/powder-coating-process']);
      }
    });
  }

  onSubmit(): void {
    if (this.processForm.valid && this.itemsFormArray.length > 0) {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.processForm);

      if (this.processForm.invalid) {
        this.snackbar.error('Please fix validation errors');
        return;
      }

      this.loading = true;
      
      const formValue = this.processForm.getRawValue();
      const requestData = {
        customerId: formValue.customerId,
        status: formValue.status,
        items: this.itemsFormArray.controls.map((control) => {
          const itemGroup = control as FormGroup;
          const itemValue = itemGroup.getRawValue();
          const item: any = {
            productId: itemValue.productId,
            quantity: itemValue.quantity,
            totalBags: itemValue.totalBags,
            unitPrice: itemValue.unitPrice,
            remarks: itemValue.remarks || ''
          };

          // Include id only for existing items in edit mode
          if (this.isEditMode && itemValue.id) {
            item.id = itemValue.id;
          }

          return item;
        })
      };

      const request = this.isEditMode ? 
        this.powderCoatingService.updateProcess(this.processId!, requestData) :
        this.powderCoatingService.createProcess(requestData);

      request.subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success(`Process ${this.isEditMode ? 'updated' : 'created'} successfully`);
            this.router.navigate(['/powder-coating-process']);
          }
          this.loading = false;
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} process`);
          this.loading = false;
        }
      });
    } else {
      this.markFormGroupTouched(this.processForm);
      if (this.itemsFormArray.length === 0) {
        this.snackbar.error('Please add at least one item');
      } else {
        this.snackbar.error('Please fix validation errors');
      }
    }
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

    // Load returns for each item
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
            // Reload returns for this item
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
              // Update unitPrice for all new items (items without id)
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