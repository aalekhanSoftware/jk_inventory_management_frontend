import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';

@Component({
    selector: 'app-password-validation-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './password-validation-modal.component.html',
    styleUrls: ['./password-validation-modal.component.scss']
})
export class PasswordValidationModalComponent implements OnInit {
    passwordForm: FormGroup;
    loading = false;
    isSubmitted = false;
    showPassword = false;

    // Only show when modalType is 'password-validation'
    display$ = this.modalService.modalState$.pipe(
        map(state => state.isOpen && state.modalType === 'password-validation')
    );

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private modalService: ModalService,
        private snackbar: SnackbarService
    ) {
        this.passwordForm = this.fb.group({
            password: ['', Validators.required]
        });
    }

    ngOnInit() {
        this.modalService.modalState$.subscribe(state => {
            if (state.isOpen && state.modalType === 'password-validation') {
                // Reset form when opening
                this.passwordForm.reset();
                this.isSubmitted = false;
                this.loading = false;
                this.showPassword = false;
            }
        });
    }

    togglePasswordVisibility() {
        this.showPassword = !this.showPassword;
    }

    close() {
        const data = this.modalService.getData();
        if (data && data.confirmation) {
            // If closing without success, emit false
            data.confirmation.next(false);
            data.confirmation.complete();
        }
        this.modalService.close();
    }

    onSubmit() {
        this.isSubmitted = true;
        if (this.passwordForm.invalid) return;

        this.loading = true;
        const password = this.passwordForm.get('password')?.value;

        this.authService.validateClientPassword(password).subscribe({
            next: (response) => {
                if (response.success) {
                    this.snackbar.success(response.message || 'Access granted');
                    const data = this.modalService.getData();
                    if (data && data.confirmation) {
                        data.confirmation.next(true);
                        data.confirmation.complete();
                    }
                    this.modalService.close();
                } else {
                    this.snackbar.error(response.message || 'Incorrect password');
                    this.passwordForm.get('password')?.setValue('');
                }
                this.loading = false;
            },
            error: (err: any) => {
                this.loading = false;
                // Try to extract message from different possible locations
                let errorMessage = 'Validation failed';

                if (err.error && typeof err.error === 'object' && err.error.message) {
                    errorMessage = err.error.message;
                } else if (err.error && typeof err.error === 'string') {
                    try {
                        const parsed = JSON.parse(err.error);
                        errorMessage = parsed.message || err.error;
                    } catch {
                        errorMessage = err.error;
                    }
                } else if (err.message) {
                    errorMessage = err.message;
                }

                this.snackbar.error(errorMessage);
                this.passwordForm.get('password')?.setValue('');
            }
        });
    }
}
