import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { EmployeeOrderService } from '../../../services/employee-order.service';
import { EmployeeService } from '../../../services/employee.service';
import { ProductService } from '../../../services/product.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-employee-order-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoaderComponent,
    RouterLink,
    SearchableSelectComponent,
    FormsModule,
    RouterModule
  ],
  templateUrl: './employee-order-form.component.html',
  styleUrls: ['./employee-order-form.component.scss']
})
export class EmployeeOrderFormComponent implements OnInit, OnDestroy {
  employeeOrderForm!: FormGroup;
  isLoading = false;
  isEditMode = false;
  orderId?: number;
  orderNumber?: string;
  products: any[] = [];
  employees: any[] = [];
  isLoadingProducts = false;
  isLoadingEmployees = false;
  private destroy$ = new Subject<void>();

  get itemsFormArray(): FormArray {
    return this.employeeOrderForm.get('items') as FormArray;
  }

  // Alt+P adds a new product row from anywhere on this page, then moves
  // focus to the new row's product search so typing can continue.
  // Guarded with preventDefault so the browser never hijacks the keystroke,
  // and scoped to this component's lifetime so other pages are unaffected.
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.repeat || this.isLoading) {
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      event.stopPropagation();
      this.addItemAndFocus();
    }
  }

  constructor(
    private fb: FormBuilder,
    private employeeOrderService: EmployeeOrderService,
    private employeeService: EmployeeService,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute,
    private snackbar: SnackbarService,
    private encryptionService: EncryptionService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // ENC_URL_POST_V1: Encrypted id in URL: decrypt before use.
    const rawId = this.route.snapshot.paramMap.get('id');
    const decrypted = rawId ? Number(this.encryptionService.decrypt(rawId)) : NaN;
    if (rawId && !decrypted) {
      this.snackbar.error('Invalid link');
      this.router.navigate(['/employee-order']);
      return;
    }
    if (decrypted) {
      this.orderId = decrypted;
      this.isEditMode = true;
      this.loadEmployeeOrder();
    } else {
      this.addItem();
    }
    this.loadProducts();
    this.loadEmployees();
  }

  /** ENC_URL_POST_V1: Encrypted id for URLs; numeric ids stay in POST bodies. */
  encId(id: number | null | undefined): string {
    return this.encryptionService.encrypt(String(id ?? ''));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.employeeOrderForm = this.fb.group({
      employeeIds: [[], Validators.required],
      remarks: [''],
      status: ['O', Validators.required],
      orderDate: [formatDate(new Date(), 'yyyy-MM-dd', 'en'), Validators.required],
      items: this.fb.array([])
    });
  }

  addItem(itemData?: any): void {
    const itemGroup = this.fb.group({
      id: [itemData?.id || null],
      productId: [itemData?.productId || '', Validators.required],
      quantity: [itemData?.quantity || '', [Validators.required, Validators.min(1)]]
    });
    this.itemsFormArray.push(itemGroup);
  }

  removeItem(index: number): void {
    if (this.itemsFormArray.length <= 1) {
      this.snackbar.error('At least one product is required');
      return;
    }
    this.itemsFormArray.removeAt(index);
  }

  private addItemAndFocus(): void {
    this.addItem();
    const newIndex = this.itemsFormArray.length - 1;
    // Wait a tick for the new row to render, then focus its product search.
    setTimeout(() => {
      const host = document.getElementById(`productId_${newIndex}`);
      host?.querySelector('input')?.focus();
    }, 0);
  }

  getTotalQuantity(): number {
    return this.itemsFormArray.controls.reduce((total, control) => {
      const quantity = Number((control as FormGroup).get('quantity')?.value) || 0;
      return total + quantity;
    }, 0);
  }

  private loadEmployeeOrder(): void {
    if (!this.orderId) return;

    this.isLoading = true;
    this.employeeOrderService.getEmployeeOrderDetail(this.orderId).subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.data;
          this.orderNumber = data.employeeOrderNumber || undefined;
          this.employeeOrderForm.patchValue({
            employeeIds: data.employeeIds || [],
            remarks: data.remarks || '',
            status: data.status || 'O',
            orderDate: data.orderDate
              ? formatDate(data.orderDate, 'yyyy-MM-dd', 'en')
              : formatDate(new Date(), 'yyyy-MM-dd', 'en')
          });

          while (this.itemsFormArray.length > 0) {
            this.itemsFormArray.removeAt(0);
          }

          // New multi-product payload first, legacy single-product fallback second.
          const items = data.items && data.items.length > 0
            ? data.items
            : (data.productId ? [{ productId: data.productId, quantity: data.quantity }] : []);
          if (items.length > 0) {
            items.forEach((item: any) => this.addItem({
              id: item.id || null,
              productId: item.productId,
              quantity: item.quantity
            }));
          } else {
            this.addItem();
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load employee order details');
        this.isLoading = false;
      }
    });
  }

  public loadProducts(): void {
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
      error: (error) => {
        this.snackbar.error('Failed to refresh products');
        this.isLoadingProducts = false;
      }
    });
  }

  public loadEmployees(): void {
    this.isLoadingEmployees = true;
    this.employeeService.getAllEmployees().subscribe({
      next: (response) => {
        if (response.success) {
          this.employees = response.data;
        }
        this.isLoadingEmployees = false;
      },
      error: () => {
        this.snackbar.error('Failed to load employees');
        this.isLoadingEmployees = false;
      }
    });
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.markFormGroupTouched(this.employeeOrderForm);
    if (this.employeeOrderForm.invalid || this.itemsFormArray.length === 0) {
      if (this.itemsFormArray.length === 0) {
        this.snackbar.error('Please add at least one product');
      } else {
        this.snackbar.error('Please fix validation errors');
      }
      return;
    }

    this.isLoading = true;
    const formValue = this.employeeOrderForm.getRawValue();
    const items = this.itemsFormArray.controls.map((control) => {
      const itemValue = (control as FormGroup).getRawValue();
      const item: any = {
        productId: Number(itemValue.productId),
        quantity: Number(itemValue.quantity)
      };
      if (this.isEditMode && itemValue.id) {
        item.id = itemValue.id;
      }
      return item;
    });

    // Send both the new multi-product payload and legacy single-product fields
    // (first item) so old backend builds keep working.
    const formData: any = {
      employeeIds: formValue.employeeIds,
      remarks: formValue.remarks || '',
      status: formValue.status,
      orderDate: formValue.orderDate,
      items,
      productId: items[0].productId,
      quantity: items[0].quantity
    };

    const request = this.isEditMode
      ? this.employeeOrderService.updateEmployeeOrder({ ...formData, id: this.orderId })
      : this.employeeOrderService.createEmployeeOrder(formData);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message);
          this.router.navigate(['/employee-order']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || error.message || `Failed to ${this.isEditMode ? 'update' : 'create'} employee order`);
        this.isLoading = false;
      }
    });
  }

  resetForm(): void {
    while (this.itemsFormArray.length > 0) {
      this.itemsFormArray.removeAt(0);
    }
    this.employeeOrderForm.reset({
      status: 'O',
      employeeIds: [],
      remarks: '',
      orderDate: formatDate(new Date(), 'yyyy-MM-dd', 'en')
    });
    this.addItem();
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.employeeOrderForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  isItemFieldInvalid(index: number, fieldName: string): boolean {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const field = itemGroup.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const control = this.employeeOrderForm.get(fieldName);
    if (control?.errors) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['min']) return 'Value must be greater than 0';
    }
    return '';
  }

  getItemFieldError(index: number, fieldName: string): string {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const control = itemGroup.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName === 'productId' ? 'Product' : 'Quantity'} is required`;
      if (control.errors['min']) return 'Value must be greater than 0';
    }
    return '';
  }

  getProductName(productId: number): string {
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : '';
  }

  isFieldInvalidControl(control: AbstractControl | null): boolean {
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }
}
